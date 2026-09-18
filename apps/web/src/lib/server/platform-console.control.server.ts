import type { SqlExecutor } from "@white-label/domains";
import type { TenantControlDashboardData } from "./platform-console.types.ts";
import { nullableString, numberValue, stringValue } from "./platform-console.values.ts";

async function queryControlRows(sql: SqlExecutor, tenantId: string) {
  return Promise.all([
    sql.query(`select t.id,t.name,t.slug,t.status,t.created_at,b.logo_url,b.primary_color,s.settings
      from public.tenants t left join public.tenant_branding b on b.tenant_id=t.id
      left join public.tenant_settings s on s.tenant_id=t.id where t.id=$1 limit 1`, [tenantId]),
    sql.query(`select s.id,s.name,s.slug,s.status,s.created_at,count(sm.user_id)::integer as member_count
      from public.stores s left join public.store_members sm on sm.tenant_id=s.tenant_id and sm.store_id=s.id
      where s.tenant_id=$1 group by s.id,s.name,s.slug,s.status,s.created_at order by s.created_at desc`, [tenantId]),
    sql.query(`select id,hostname,type,status,store_id,verified_at,created_at
      from public.domains where tenant_id=$1 order by created_at desc`, [tenantId]),
    sql.query(`select sub.id,sub.level,sub.status,sub.created_at,p.name as plan_name,p.price_cents
      from public.subscriptions sub left join public.plans p on p.id=sub.plan_id
      where sub.tenant_id=$1 order by sub.created_at desc`, [tenantId]),
    sql.query(`select id,level,amount_cents,status,created_at
      from public.payments where tenant_id=$1 order by created_at desc limit 50`, [tenantId]),
    sql.query(`select id,slug,name,price_cents from public.plans order by price_cents,name`, []),
    sql.query(`select id,provider,label,level,store_id,created_at
      from public.gateway_accounts where tenant_id=$1 order by created_at desc`, [tenantId]),
  ]);
}

function settingsJson(value: unknown): string {
  return JSON.stringify(value ?? {}) ?? "{}";
}

export async function loadTenantControlData(
  sql: SqlExecutor,
  tenantId: string,
): Promise<TenantControlDashboardData> {
  const [tenantRows, stores, domains, subscriptions, payments, plans, gateways] = await queryControlRows(sql, tenantId);
  const tenant = tenantRows.at(0);
  if (tenant === undefined) throw new Error("White Label não encontrada");
  return {
    tenant: {id:stringValue(tenant,"id"),name:stringValue(tenant,"name"),slug:stringValue(tenant,"slug"),status:stringValue(tenant,"status"),createdAt:stringValue(tenant,"created_at"),logoUrl:nullableString(tenant,"logo_url"),primaryColor:nullableString(tenant,"primary_color"),settings:settingsJson(tenant["settings"])},
    stores: stores.map((r)=>({id:stringValue(r,"id"),name:stringValue(r,"name"),slug:stringValue(r,"slug"),status:stringValue(r,"status"),createdAt:stringValue(r,"created_at"),memberCount:numberValue(r,"member_count")})),
    domains: domains.map((r)=>({id:stringValue(r,"id"),hostname:stringValue(r,"hostname"),type:stringValue(r,"type"),status:stringValue(r,"status"),storeId:nullableString(r,"store_id"),verifiedAt:nullableString(r,"verified_at")})),
    subscriptions: subscriptions.map((r)=>({id:stringValue(r,"id"),level:stringValue(r,"level"),status:stringValue(r,"status"),planName:nullableString(r,"plan_name"),priceCents:numberValue(r,"price_cents"),createdAt:stringValue(r,"created_at")})),
    payments: payments.map((r)=>({id:stringValue(r,"id"),level:stringValue(r,"level"),amountCents:numberValue(r,"amount_cents"),status:stringValue(r,"status"),createdAt:stringValue(r,"created_at")})),
    plans: plans.map((r)=>({id:stringValue(r,"id"),slug:stringValue(r,"slug"),name:stringValue(r,"name"),priceCents:numberValue(r,"price_cents")})),
    gateways: gateways.map((r)=>({id:stringValue(r,"id"),provider:stringValue(r,"provider"),label:stringValue(r,"label"),level:stringValue(r,"level"),storeId:nullableString(r,"store_id"),createdAt:stringValue(r,"created_at")})),
  };
}
