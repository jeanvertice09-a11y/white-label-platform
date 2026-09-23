import type { WorkerSql } from "../database.ts";
import { enqueueJob } from "./store.ts";

function value(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  return typeof raw === "string" ? raw : "";
}

// Recovery scheduling intentionally stays beside the existing queue discovery so all operational work shares one idempotent pass.
// eslint-disable-next-line max-lines-per-function
export async function scheduleOperationalJobs(sql: WorkerSql): Promise<number> {
  const [domains,billing,media,storePayments,shipments] = await Promise.all([
    sql.query(
      `select id::text,tenant_id::text,store_id::text,verification_token
       from public.domains
       join public.tenants t on t.id=domains.tenant_id
       left join public.stores s on s.tenant_id=domains.tenant_id and s.id=domains.store_id
       where domains.status='pending' and t.status in ('trial','active')
         and (domains.store_id is null or s.status='active') and verified_at is null and verification_token is not null
         and not exists (select 1 from public.operational_jobs j where j.kind='domain.verify'
           and j.idempotency_key='domain:'||domains.id::text||':'||domains.verification_token)
       order by created_at limit 25`,[]),
    sql.query(
      `select id::text,tenant_id::text,store_id::text,level
       from public.payments
       left join public.tenants t on t.id=payments.tenant_id
       left join public.stores s on s.tenant_id=payments.tenant_id and s.id=payments.store_id
       where (payments.tenant_id is null or t.status in ('trial','active'))
         and (payments.store_id is null or s.status='active')
         and level in ('platform_billing','tenant_billing')
         and status in ('pending','authorized') and provider_payment_id is not null
         and not exists (select 1 from public.operational_jobs j where j.kind='billing.reconcile'
           and j.idempotency_key='billing:'||payments.id::text)
       order by updated_at nulls first,created_at limit 25`,[]),
    sql.query(
      `select id::text,tenant_id::text,store_id::text,status
       from public.media_assets m
       join public.tenants t on t.id=m.tenant_id
       left join public.stores s on s.tenant_id=m.tenant_id and s.id=m.store_id
       where t.status in ('trial','active') and (m.store_id is null or s.status='active')
         and status <> 'legacy' and (
         (status='pending' and upload_expires_at < now())
         or (status in ('ready','failed','delete_pending') and created_at < now()-interval '24 hours'
           and not exists(select 1 from public.product_images i where i.tenant_id=m.tenant_id and i.asset_id=m.id)
           and not exists(select 1 from public.store_banners b where b.tenant_id=m.tenant_id and b.asset_id=m.id)
           and not exists(select 1 from public.tenant_branding tb where tb.tenant_id=m.tenant_id and tb.logo_asset_id=m.id))
       ) and not exists (select 1 from public.operational_jobs j where j.kind='media.process'
         and j.idempotency_key='media:'||m.id::text||':'||m.status)
       order by created_at limit 25`,[]),
    sql.query(`select p.id::text,p.tenant_id::text,p.store_id::text,p.updated_at::text from public.payments p join public.tenants t on t.id=p.tenant_id join public.stores s on s.tenant_id=p.tenant_id and s.id=p.store_id where p.level='store_checkout' and p.status in ('pending','authorized') and p.provider_payment_id is not null and t.status in ('trial','active') and s.status='active' and p.updated_at < now()-interval '10 minutes' and not exists(select 1 from public.operational_jobs j where j.kind='store_payment.reconcile' and j.idempotency_key='store-payment:'||p.id::text||':'||floor(extract(epoch from p.updated_at)/600)::text) order by p.updated_at limit 25`,[]),
    sql.query(`select sh.id::text,sh.tenant_id::text,sh.store_id::text,sh.order_id::text,sh.status from public.order_shipments sh join public.orders o on o.tenant_id=sh.tenant_id and o.store_id=sh.store_id and o.id=sh.order_id join public.tenants t on t.id=sh.tenant_id join public.stores s on s.tenant_id=sh.tenant_id and s.id=sh.store_id where t.status in ('trial','active') and s.status='active' and o.payment_status='paid' and sh.status in ('quoted','error') and sh.updated_at < now()-interval '5 minutes' and not exists(select 1 from public.operational_jobs j where j.kind='shipment.recover' and j.idempotency_key='shipment:'||sh.id::text||':'||sh.status) order by sh.updated_at limit 25`,[]),
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
  for(const row of storePayments){const id=value(row,"id"),updated=value(row,"updated_at");if(id&&await enqueueJob(sql,{tenantId:value(row,"tenant_id"),storeId:value(row,"store_id"),kind:"store_payment.reconcile",payload:{paymentId:id},idempotencyKey:`store-payment:${id}:${String(Math.floor(Date.parse(updated)/600000))}`,maxAttempts:12}))created++;}
  for(const row of shipments){const id=value(row,"id"),status=value(row,"status");if(id&&await enqueueJob(sql,{tenantId:value(row,"tenant_id"),storeId:value(row,"store_id"),kind:"shipment.recover",payload:{shipmentId:id,orderId:value(row,"order_id")},idempotencyKey:`shipment:${id}:${status}`,maxAttempts:8}))created++;}
  return created;
}
