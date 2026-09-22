import type { WorkerSql } from "../database.ts";
import { enqueueJob } from "./store.ts";

function value(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  return typeof raw === "string" ? raw : "";
}

export async function scheduleOperationalJobs(sql: WorkerSql): Promise<number> {
  const [domains,billing,media] = await Promise.all([
    sql.query(
      `select id::text,tenant_id::text,store_id::text,verification_token
       from public.domains
       where status='pending' and verified_at is null and verification_token is not null
         and not exists (select 1 from public.operational_jobs j where j.kind='domain.verify'
           and j.idempotency_key='domain:'||domains.id::text||':'||domains.verification_token)
       order by created_at limit 25`,[]),
    sql.query(
      `select id::text,tenant_id::text,store_id::text,level
       from public.payments
       where level in ('platform_billing','tenant_billing')
         and status in ('pending','authorized') and provider_payment_id is not null
         and not exists (select 1 from public.operational_jobs j where j.kind='billing.reconcile'
           and j.idempotency_key='billing:'||payments.id::text)
       order by updated_at nulls first,created_at limit 25`,[]),
    sql.query(
      `select id::text,tenant_id::text,store_id::text,status
       from public.media_assets m
       where status <> 'legacy' and (
         (status='pending' and upload_expires_at < now())
         or (status in ('ready','failed','delete_pending') and created_at < now()-interval '24 hours'
           and not exists(select 1 from public.product_images i where i.tenant_id=m.tenant_id and i.asset_id=m.id)
           and not exists(select 1 from public.store_banners b where b.tenant_id=m.tenant_id and b.asset_id=m.id)
           and not exists(select 1 from public.tenant_branding tb where tb.tenant_id=m.tenant_id and tb.logo_asset_id=m.id))
       ) and not exists (select 1 from public.operational_jobs j where j.kind='media.process'
         and j.idempotency_key='media:'||m.id::text||':'||m.status)
       order by created_at limit 25`,[]),
  ]);
  let created=0;
  for (const row of domains) {
    const id=value(row,"id"), token=value(row,"verification_token");
    if (id && token && await enqueueJob(sql,{tenantId:value(row,"tenant_id"),storeId:value(row,"store_id")||null,
      kind:"domain.verify",payload:{domainId:id},idempotencyKey:`domain:${id}:${token}`,maxAttempts:20})) created++;
  }
  for (const row of billing) {
    const id=value(row,"id");
    if (id && await enqueueJob(sql,{tenantId:value(row,"tenant_id")||null,storeId:value(row,"store_id")||null,
      kind:"billing.reconcile",payload:{paymentId:id},idempotencyKey:`billing:${id}`,maxAttempts:12})) created++;
  }
  for (const row of media) {
    const id=value(row,"id"), status=value(row,"status");
    if (id && await enqueueJob(sql,{tenantId:value(row,"tenant_id"),storeId:value(row,"store_id")||null,
      kind:"media.process",payload:{assetId:id},idempotencyKey:`media:${id}:${status}`,maxAttempts:8})) created++;
  }
  return created;
}
