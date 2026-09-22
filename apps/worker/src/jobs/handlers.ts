import { resolveCname, resolveTxt } from "node:dns/promises";
import { DnsDomainProvider } from "@white-label/domains";
import { createCredentialVaultFromEnv, loadGatewayProvider, reconcilePaymentStatus } from "@white-label/payments/server";
import type { PaymentProviderName, ProviderPaymentId } from "@white-label/payments";
import { createR2StorageProvider } from "@white-label/storage/server";
import type { WorkerSql } from "../database.ts";
import type { OperationalJob } from "./types.ts";

function required(job: OperationalJob,key: string): string {
  const value=job.payload[key];
  if(typeof value!=="string"||!value) throw new Error(`Payload inválido: ${key}`);
  return value;
}
function rowText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Campo persistido inválido: ${key}`);
  return value;
}
function providerName(value: unknown): PaymentProviderName {
  if(value==="mercadopago"||value==="asaas") return value;
  throw new Error("Provider persistido inválido.");
}
async function assertJobScopeOperational(sql: WorkerSql, job: OperationalJob): Promise<void> {
  if (!job.tenantId) return;
  const rows=await sql.query(`select t.status tenant_status,s.status store_status from public.tenants t
    left join public.stores s on s.tenant_id=t.id and s.id=$2::uuid
    where t.id=$1::uuid and ($2::uuid is null or s.id is not null) limit 1`,[job.tenantId,job.storeId]);
  const row=rows.at(0);
  if(!row||row["tenant_status"]==="suspended"||(job.storeId&&row["store_status"]!=="active")) throw new Error("Escopo do job suspenso ou inexistente.");
}
function asaasBaseUrl(): string {
  return process.env["ASAAS_ENV"]==="production"?"https://api.asaas.com/v3":"https://api-sandbox.asaas.com/v3";
}

async function verifyDomain(sql: WorkerSql,job: OperationalJob): Promise<void> {
  await assertJobScopeOperational(sql,job);
  const domainId=required(job,"domainId");
  const rows=await sql.query(
    `select id::text,tenant_id::text,store_id::text,hostname,status,verification_token
     from public.domains where id=$1::uuid and tenant_id=$2::uuid limit 1`,
    [domainId,job.tenantId],
  );
  const row=rows.at(0); if(!row) throw new Error("Domínio fora do escopo do job.");
  if(row["status"]==="active") return;
  if(row["status"]!=="pending") throw new Error("Domínio não está pendente.");
  const hostname=rowText(row,"hostname"), token=rowText(row,"verification_token");
  const provider=new DnsDomainProvider(process.env["DOMAIN_CNAME_TARGET"]?.trim()||null,{resolveCname,resolveTxt});
  const result=await provider.verifyDomain({hostname,verificationToken:token});
  if(!result.configured) throw new Error(result.reason);
  if(!result.verified) throw new Error(result.reason);
  const changed=await sql.query(
    `update public.domains set status='active',verified_at=now()
     where id=$1::uuid and tenant_id=$2::uuid and status='pending' and verification_token=$3
     returning id::text`,[domainId,job.tenantId,token]);
  if(!changed[0]) throw new Error("Domínio mudou durante a verificação.");
  await sql.query(
    `insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     values(null,$1::uuid,$2::uuid,'worker.domain.verified','domain',$3,jsonb_build_object('provider','dns'))`,
    [job.tenantId,job.storeId,domainId]);
}

async function reconcileBilling(sql: WorkerSql,job: OperationalJob): Promise<void> {
  await assertJobScopeOperational(sql,job);
  const paymentId=required(job,"paymentId");
  const rows=await sql.query(
    `select p.id::text,p.tenant_id::text,p.store_id::text,p.gateway_account_id::text,
       p.provider_payment_id,p.level,ga.provider
     from public.payments p join public.gateway_accounts ga on ga.id=p.gateway_account_id
     where p.id=$1::uuid and p.tenant_id is not distinct from $2::uuid
       and p.store_id is not distinct from $3::uuid
       and p.level in ('platform_billing','tenant_billing') limit 1`,
    [paymentId,job.tenantId,job.storeId]);
  const row=rows.at(0); if(!row) throw new Error("Pagamento fora do escopo do job.");
  const gatewayId=rowText(row,"gateway_account_id"), providerPaymentId=rowText(row,"provider_payment_id");
  const provider=providerName(row["provider"]);
  const loaded=await loadGatewayProvider(sql,createCredentialVaultFromEnv(),provider,gatewayId,{
    writesEnabled:false,asaasBaseUrl:asaasBaseUrl(),
  });
  if(loaded.level!==row["level"]||loaded.tenantId!==job.tenantId||loaded.storeId!==null) {
    throw new Error("Gateway incompatível com escopo de billing.");
  }
  const result=await reconcilePaymentStatus(sql,paymentId,gatewayId,loaded.provider,providerPaymentId as ProviderPaymentId);
  if(result.status==="pending"||result.status==="authorized") {
    throw new Error(`Pagamento ainda não atingiu estado final: ${result.status}`);
  }
}

async function processMedia(sql: WorkerSql,job: OperationalJob): Promise<void> {
  await assertJobScopeOperational(sql,job);
  const assetId=required(job,"assetId");
  const rows=await sql.query(
    `select id::text,tenant_id::text,store_id::text,object_key,status
     from public.media_assets where id=$1::uuid and tenant_id=$2::uuid
       and store_id is not distinct from $3::uuid limit 1`,
    [assetId,job.tenantId,job.storeId]);
  const row=rows.at(0); if(!row) throw new Error("Mídia fora do escopo do job.");
  if(row["status"]==="deleted") return;
  const claimed=await sql.query(`select public.claim_media_asset_deletion($1::uuid,$2::uuid,$3::uuid) claimed`,
    [job.tenantId,job.storeId,assetId]);
  if(claimed[0]?.["claimed"]!==true) return;
  const storage=createR2StorageProvider();
  try {
    await storage.deleteObject(rowText(row,"object_key"));
    await sql.query(`with deleted as (
      update public.media_assets set status='deleted',deleted_at=now(),last_error=null,updated_at=now()
      where id=$1::uuid and tenant_id=$2::uuid and store_id is not distinct from $3::uuid and status='delete_pending'
      returning id,tenant_id,store_id)
      insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
      select null,tenant_id,store_id,'worker.media.deleted','media_asset',id::text,jsonb_build_object('source','orphan_cleanup') from deleted`,
      [assetId,job.tenantId,job.storeId]);
  } catch(error) {
    const message=error instanceof Error?error.message.slice(0,1000):"Falha R2";
    await sql.query(`update public.media_assets set status='failed',last_error=$4,updated_at=now()
      where id=$1::uuid and tenant_id=$2::uuid and store_id is not distinct from $3::uuid and status='delete_pending'`,
      [assetId,job.tenantId,job.storeId,message]);
    throw error;
  }
}

export async function dispatchOperationalJob(sql: WorkerSql,job: OperationalJob): Promise<void> {
  switch(job.kind){
    case "domain.verify": return verifyDomain(sql,job);
    case "billing.reconcile": return reconcileBilling(sql,job);
    case "media.process": return processMedia(sql,job);
    case "email.send": throw new Error("email.send indisponível: nenhum provider de e-mail foi configurado.");
  }
}
