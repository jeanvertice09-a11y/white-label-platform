import type { DomainProvider, DomainVerificationResult } from "@white-label/domains";
import type { ControlSql } from "./control-merchants.shared.server.ts";

function stringValue(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function auditVerificationRequest(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  domainId: string,
  result: DomainVerificationResult,
  providerName: string,
): Promise<void> {
  await sql.query(
    `insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     select $3::uuid,d.tenant_id,d.store_id,'control.domain.verification_requested','domain',d.id::text,
       jsonb_build_object(
         'provider',$4::text,'configured',$5::boolean,'verified',$6::boolean,
         'reason',$7::text,'cname_match',$8::boolean,'txt_match',$9::boolean
       )
     from public.domains d where d.tenant_id=$1::uuid and d.id=$2::uuid`,
    [
      tenantId,
      domainId,
      actorUserId,
      providerName,
      result.configured,
      result.verified,
      result.reason,
      result.evidence.cnameMatches,
      result.evidence.txtMatches,
    ],
  );
}

export async function verifyControlDomain(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  domainId: string,
  provider: DomainProvider,
) {
  const rows = await sql.query(
    `select id::text,hostname,status,verification_token,verified_at::text
     from public.domains where tenant_id=$1::uuid and id=$2::uuid limit 1`,
    [tenantId, domainId],
  );
  if (rows.length === 0) throw new Error("Domínio não encontrado nesta White Label.");
  const row = rows[0];
  const hostname = stringValue(row, "hostname");
  const status = stringValue(row, "status");
  const token = stringValue(row, "verification_token");
  if (!hostname || !status) throw new Error("Registro de domínio inválido.");
  if (status === "suspended") throw new Error("Domínio suspenso deve voltar para pending antes da verificação.");
  if (status === "active" && stringValue(row, "verified_at")) {
    return { verified: true, status: "active" as const, reason: "Domínio já está ativo e verificado." };
  }
  if (!token) throw new Error("Domínio não possui desafio de verificação. Edite ou reabra o domínio para gerar um novo desafio.");

  const result = await provider.verifyDomain({ hostname, verificationToken: token });
  await auditVerificationRequest(sql, tenantId, actorUserId, domainId, result, provider.name);
  if (!result.verified) return { verified: false, status: "pending" as const, reason: result.reason };

  const activated = await sql.query(
    `with target as (
       update public.domains set status='active',verified_at=now()
       where tenant_id=$1::uuid and id=$2::uuid and hostname=$3
         and verification_token=$4 and status='pending'
       returning id,tenant_id,store_id,verified_at
     ), verified_audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,tenant_id,store_id,'control.domain.verified','domain',id::text,
         jsonb_build_object('provider',$6::text,'verified_at',verified_at)
       from target returning id
     ), activated_audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,tenant_id,store_id,'control.domain.activated','domain',id::text,
         jsonb_build_object('source','dns_verification')
       from target returning id
     ) select id::text,verified_at::text from target`,
    [tenantId, domainId, hostname, token, actorUserId, provider.name],
  );
  if (activated.length === 0) throw new Error("Domínio mudou durante a verificação; tente novamente.");
  return { verified: true, status: "active" as const, reason: result.reason };
}
