import type { SqlExecutor } from "@white-label/domains";
import type { MasterConsoleData } from "./platform-console.types.ts";
import { nullableString, numberValue, stringValue } from "./platform-console.values.ts";

async function queryMasterRows(sql: SqlExecutor) {
  return Promise.all([
    sql.query(`select
      (select count(*) from public.tenants)::integer as tenants,
      (select count(*) from public.tenants where status='active')::integer as active_tenants,
      (select count(*) from public.tenants where status='trial')::integer as trial_tenants,
      (select count(*) from public.stores where status='active')::integer as active_stores,
      (select count(*) from public.subscriptions where level='platform_billing' and status='active')::integer as active_subscriptions,
      (select coalesce(sum(amount_cents),0) from public.payments where level='platform_billing' and status='paid')::bigint as paid_cents,
      (select count(*) from public.domains where status='active')::integer as active_domains`, []),
    sql.query(`select t.id,t.name,t.slug,t.status,t.created_at,
      count(distinct s.id)::integer as store_count,
      count(distinct s.id) filter (where s.status='active')::integer as active_store_count,
      latest.status as subscription_status,latest.plan_name
      from public.tenants t left join public.stores s on s.tenant_id=t.id
      left join lateral (select sub.status,p.name as plan_name from public.subscriptions sub
        left join public.plans p on p.id=sub.plan_id where sub.tenant_id=t.id and sub.level='platform_billing'
        order by sub.created_at desc limit 1) latest on true
      group by t.id,t.name,t.slug,t.status,t.created_at,latest.status,latest.plan_name
      order by t.created_at desc`, []),
    sql.query(`select p.id,p.amount_cents,p.status,p.created_at,t.name as tenant_name
      from public.payments p left join public.tenants t on t.id=p.tenant_id
      where p.level='platform_billing' order by p.created_at desc limit 50`, []),
    sql.query(`select id,action,resource_type,resource_id,tenant_id,actor_user_id,created_at
      from public.audit_logs order by created_at desc limit 50`, []),
    sql.query(`select id,hostname,type,status,tenant_id,store_id,verified_at,created_at
      from public.domains order by created_at desc limit 100`, []),
    sql.query(`select id,provider,label,level,tenant_id,store_id,created_at
      from public.gateway_accounts order by created_at desc limit 100`, []),
  ]);
}

export async function loadMasterConsoleData(sql: SqlExecutor): Promise<MasterConsoleData> {
  const [metricsRows, tenants, payments, audits, domains, gateways] = await queryMasterRows(sql);
  const metrics = metricsRows.at(0) ?? {};
  return {
    metrics: {
      tenants: numberValue(metrics,"tenants"), activeTenants: numberValue(metrics,"active_tenants"),
      trialTenants: numberValue(metrics,"trial_tenants"), activeStores: numberValue(metrics,"active_stores"),
      activeSubscriptions: numberValue(metrics,"active_subscriptions"), paidCents: numberValue(metrics,"paid_cents"),
      activeDomains: numberValue(metrics,"active_domains"),
    },
    tenants: tenants.map((r)=>({id:stringValue(r,"id"),name:stringValue(r,"name"),slug:stringValue(r,"slug"),status:stringValue(r,"status"),createdAt:stringValue(r,"created_at"),storeCount:numberValue(r,"store_count"),activeStoreCount:numberValue(r,"active_store_count"),subscriptionStatus:nullableString(r,"subscription_status"),planName:nullableString(r,"plan_name")})),
    payments: payments.map((r)=>({id:stringValue(r,"id"),tenantName:nullableString(r,"tenant_name"),amountCents:numberValue(r,"amount_cents"),status:stringValue(r,"status"),createdAt:stringValue(r,"created_at")})),
    audits: audits.map((r)=>({id:stringValue(r,"id"),action:stringValue(r,"action"),resourceType:stringValue(r,"resource_type"),resourceId:nullableString(r,"resource_id"),tenantId:nullableString(r,"tenant_id"),actorUserId:nullableString(r,"actor_user_id"),createdAt:stringValue(r,"created_at")})),
    domains: domains.map((r)=>({id:stringValue(r,"id"),hostname:stringValue(r,"hostname"),type:stringValue(r,"type"),status:stringValue(r,"status"),tenantId:stringValue(r,"tenant_id"),storeId:nullableString(r,"store_id"),verifiedAt:nullableString(r,"verified_at"),createdAt:stringValue(r,"created_at")})),
    gateways: gateways.map((r)=>({id:stringValue(r,"id"),provider:stringValue(r,"provider"),label:stringValue(r,"label"),level:stringValue(r,"level"),tenantId:nullableString(r,"tenant_id"),storeId:nullableString(r,"store_id"),createdAt:stringValue(r,"created_at")})),
  };
}
