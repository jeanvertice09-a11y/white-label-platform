import type { ControlSql } from "./control-merchants.shared.server.ts";
import type {
  TenantBillingMetrics,
  TenantBillingSubscriptionRow,
  TenantBillingWorkspace,
} from "./tenant-billing.types.ts";

interface SearchInput {
  query: string;
  status: "all" | "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";
  page: number;
  pageSize: number;
}

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function loadTenantBillingMetrics(
  sql: ControlSql,
  tenantId: string,
): Promise<TenantBillingMetrics> {
  const rows = await sql.query(
    `select
       count(*) filter (where s.status='active')::int subscriptions_active,
       count(*) filter (where s.status='trialing')::int subscriptions_trialing,
       count(*) filter (where s.status='past_due')::int subscriptions_past_due,
       (select count(*)::int from public.payments p
         where p.level='tenant_billing' and p.tenant_id=$1::uuid and p.status='pending') payments_pending,
       (select count(*)::int from public.payments p
         where p.level='tenant_billing' and p.tenant_id=$1::uuid and p.status='captured') payments_captured,
       (select count(*)::int from public.payments p
         where p.level='tenant_billing' and p.tenant_id=$1::uuid
           and p.status in ('failed','chargeback')) payments_failed,
       (select coalesce(sum(p.amount_cents),0)::bigint from public.payments p
         where p.level='tenant_billing' and p.tenant_id=$1::uuid and p.status='captured') revenue_captured_cents
     from public.store_subscriptions s
     where s.tenant_id=$1::uuid`,
    [tenantId],
  );
  const row = rows.at(0) ?? {};
  return {
    subscriptionsActive: numberValue(row, "subscriptions_active"),
    subscriptionsTrialing: numberValue(row, "subscriptions_trialing"),
    subscriptionsPastDue: numberValue(row, "subscriptions_past_due"),
    paymentsPending: numberValue(row, "payments_pending"),
    paymentsCaptured: numberValue(row, "payments_captured"),
    paymentsFailed: numberValue(row, "payments_failed"),
    revenueCapturedCents: numberValue(row, "revenue_captured_cents"),
  };
}

async function subscriptionRows(
  sql: ControlSql,
  tenantId: string,
  input: SearchInput,
): Promise<Row[]> {
  const offset = (input.page - 1) * input.pageSize;
  return sql.query(
    `select s.id::text subscription_id,s.store_id::text,st.name store_name,
       s.tenant_plan_id::text plan_id,p.name plan_name,s.status,
       s.trial_ends_at::text,s.current_period_ends_at::text,
       pay.status last_payment_status,pay.amount_cents last_payment_amount_cents,
       pay.created_at::text last_payment_created_at
     from public.store_subscriptions s
     join public.stores st on st.tenant_id=s.tenant_id and st.id=s.store_id
     join public.tenant_plans p on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
     left join lateral (
       select x.status,x.amount_cents,x.created_at
       from public.payments x
       where x.level='tenant_billing' and x.tenant_id=s.tenant_id
         and x.store_id=s.store_id and x.store_subscription_id=s.id
       order by x.created_at desc,x.id desc limit 1
     ) pay on true
     where s.tenant_id=$1::uuid
       and ($2='' or st.name ilike '%'||$2||'%' or p.name ilike '%'||$2||'%')
       and ($3='all' or s.status=$3)
     order by s.created_at desc,s.id
     limit $4 offset $5`,
    [tenantId, input.query.trim(), input.status, input.pageSize, offset],
  );
}

async function subscriptionCount(
  sql: ControlSql,
  tenantId: string,
  input: SearchInput,
): Promise<number> {
  const rows = await sql.query(
    `select count(*)::int total
     from public.store_subscriptions s
     join public.stores st on st.tenant_id=s.tenant_id and st.id=s.store_id
     join public.tenant_plans p on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
     where s.tenant_id=$1::uuid
       and ($2='' or st.name ilike '%'||$2||'%' or p.name ilike '%'||$2||'%')
       and ($3='all' or s.status=$3)`,
    [tenantId, input.query.trim(), input.status],
  );
  return numberValue(rows.at(0) ?? {}, "total");
}

function mapSubscription(row: Row): TenantBillingSubscriptionRow {
  const amount = row["last_payment_amount_cents"];
  return {
    subscriptionId: text(row, "subscription_id"),
    storeId: text(row, "store_id"),
    storeName: text(row, "store_name"),
    planId: text(row, "plan_id"),
    planName: text(row, "plan_name"),
    status: text(row, "status"),
    trialEndsAt: nullableText(row, "trial_ends_at"),
    currentPeriodEndsAt: nullableText(row, "current_period_ends_at"),
    lastPaymentStatus: nullableText(row, "last_payment_status"),
    lastPaymentAmountCents: amount === null || amount === undefined ? null : numberValue(row, "last_payment_amount_cents"),
    lastPaymentCreatedAt: nullableText(row, "last_payment_created_at"),
  };
}

async function gatewayReady(sql: ControlSql, tenantId: string): Promise<boolean> {
  const rows = await sql.query(
    `select count(*)::int total from public.gateway_accounts
     where level='tenant_billing' and tenant_id=$1::uuid and store_id is null and status='active'`,
    [tenantId],
  );
  return numberValue(rows.at(0) ?? {}, "total") === 1;
}

export async function loadTenantBillingWorkspace(
  sql: ControlSql,
  tenantId: string,
  input: SearchInput = { query: "", status: "all", page: 1, pageSize: 20 },
): Promise<TenantBillingWorkspace> {
  const metrics = await loadTenantBillingMetrics(sql, tenantId);
  const rows = await subscriptionRows(sql, tenantId, input);
  const total = await subscriptionCount(sql, tenantId, input);
  const ready = await gatewayReady(sql, tenantId);
  return {
    metrics,
    subscriptions: rows.map(mapSubscription),
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    gatewayReady: ready,
  };
}
