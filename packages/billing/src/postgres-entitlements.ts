import type {
  BillingScope,
  StoreSubscriptionSnapshot,
  StoreSubscriptionStatus,
} from "./commercial-types.ts";

export interface BillingSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo inválido: ${key}`);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Campo inválido: ${key}`);
}

function bool(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Campo inválido: ${key}`);
  return value;
}

function integer(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`Inteiro inválido: ${key}`);
  return value;
}

async function loadEffectiveEntitlementRows(
  sql: BillingSqlExecutor,
  scope: BillingScope,
): Promise<Record<string, unknown>[]> {
  return sql.query(
    `with current_subscription as (
       select * from public.store_subscriptions
       where tenant_id=$1 and store_id=$2
       order by created_at desc limit 1
     )
     select
       s.id as subscription_id,s.tenant_id,s.store_id,s.status,
       s.trial_started_at,s.trial_ends_at,s.current_period_ends_at,
       p.id as plan_id,p.name as plan_name,
       d.key as entitlement_key,d.kind,
       case when d.kind='feature' then
         (coalesce(te.enabled,false) and coalesce(e.enabled,te.enabled,false))
         else null end as enabled,
       case when d.kind='limit' then
         case
           when te.limit_value is null then null
           when e.limit_value is null then te.limit_value
           else least(te.limit_value,e.limit_value)
         end
         else null end as limit_value
     from current_subscription s
     join public.tenant_plans p
       on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
     left join public.plan_template_entitlements te
       on te.template_id=p.template_id
     left join public.entitlement_definitions d
       on d.key=te.entitlement_key and d.active=true
     left join public.tenant_plan_entitlements e
       on e.tenant_id=p.tenant_id and e.tenant_plan_id=p.id
      and e.entitlement_key=te.entitlement_key
     order by d.key nulls last`,
    [scope.tenantId, scope.storeId],
  );
}

export async function loadStoreEntitlementSnapshot(
  sql: BillingSqlExecutor,
  scope: BillingScope,
): Promise<StoreSubscriptionSnapshot | null> {
  const rows = await loadEffectiveEntitlementRows(sql, scope);
  if (rows.length === 0) return null;

  const first = rows[0];
  const features: Record<string, boolean> = {};
  const limits: Record<string, number> = {};
  for (const row of rows) {
    const key = row["entitlement_key"];
    const kind = row["kind"];
    if (typeof key !== "string" || typeof kind !== "string") continue;
    if (kind === "feature") features[key] = bool(row, "enabled");
    if (kind === "limit" && row["limit_value"] !== null) limits[key] = integer(row, "limit_value");
  }

  return {
    subscriptionId: text(first, "subscription_id"),
    tenantId: text(first, "tenant_id"),
    storeId: text(first, "store_id"),
    planId: text(first, "plan_id"),
    planName: text(first, "plan_name"),
    status: text(first, "status") as StoreSubscriptionStatus,
    trialStartedAt: nullableText(first, "trial_started_at"),
    trialEndsAt: nullableText(first, "trial_ends_at"),
    currentPeriodEndsAt: nullableText(first, "current_period_ends_at"),
    features,
    limits,
  };
}
