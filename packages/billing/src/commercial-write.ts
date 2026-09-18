import type {
  BillingScope,
  StoreSubscriptionStatus,
  TenantPlanEntitlementInput,
  TenantPlanInput,
} from "./commercial-types.ts";
import type { BillingSqlExecutor } from "./postgres-entitlements.ts";

function assertPlanInput(input: TenantPlanInput): void {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) throw new Error("Slug de plano inválido");
  if (!input.name.trim() || input.name.length > 160) throw new Error("Nome de plano inválido");
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 0) throw new Error("Preço inválido");
  if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0) throw new Error("Ordem inválida");
  if (!Number.isInteger(input.trialDays) || input.trialDays < 0 || input.trialDays > 365) {
    throw new Error("Dias de trial inválidos");
  }
  if (input.trialEnabled !== (input.trialDays > 0)) {
    throw new Error("Configuração de trial inconsistente");
  }
}

export async function saveTenantPlan(
  sql: BillingSqlExecutor,
  tenantId: string,
  input: TenantPlanInput,
): Promise<string> {
  assertPlanInput(input);
  const rows = await sql.query(
    `insert into public.tenant_plans (
       tenant_id,template_id,slug,name,description,price_cents,billing_interval,
       active,trial_enabled,trial_days,display_order,recommended
     )
     select $1,t.id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
     from public.plan_templates t
     where t.id=$2 and t.active=true
     on conflict (tenant_id,template_id) do update set
       slug=excluded.slug,name=excluded.name,description=excluded.description,
       price_cents=excluded.price_cents,billing_interval=excluded.billing_interval,
       active=excluded.active,trial_enabled=excluded.trial_enabled,trial_days=excluded.trial_days,
       display_order=excluded.display_order,recommended=excluded.recommended,updated_at=now()
     returning id`,
    [
      tenantId,
      input.templateId,
      input.slug,
      input.name.trim(),
      input.description?.trim() || null,
      input.priceCents,
      input.billingInterval,
      input.active,
      input.trialEnabled,
      input.trialDays,
      input.displayOrder,
      input.recommended,
    ],
  );
  const row = rows[0];
  if (!row || typeof row["id"] !== "string") {
    throw new Error("Template inexistente/inativo ou plano não salvo");
  }
  return row["id"];
}

function normalizedEntitlements(values: TenantPlanEntitlementInput[]): TenantPlanEntitlementInput[] {
  const keys = new Set<string>();
  return values.map((value) => {
    if (!value.key || keys.has(value.key)) throw new Error("Entitlement duplicado/inválido");
    keys.add(value.key);
    if (value.kind === "feature") {
      if (typeof value.enabled !== "boolean" || value.limitValue !== null) {
        throw new Error(`Feature inválida: ${value.key}`);
      }
    } else if (value.enabled !== null || !Number.isSafeInteger(value.limitValue) || (value.limitValue ?? -1) < 0) {
      throw new Error(`Limite inválido: ${value.key}`);
    }
    return value;
  });
}

export async function replaceTenantPlanEntitlements(
  sql: BillingSqlExecutor,
  tenantId: string,
  planId: string,
  values: TenantPlanEntitlementInput[],
): Promise<void> {
  const payload = normalizedEntitlements(values);
  const rows = await sql.query(
    `with owned_plan as (
       select id from public.tenant_plans where tenant_id=$1 and id=$2
     ), deleted as (
       delete from public.tenant_plan_entitlements
       where tenant_id=$1 and tenant_plan_id in (select id from owned_plan)
       returning entitlement_key
     ), payload as (
       select * from jsonb_to_recordset($3::jsonb)
         as x(key text,kind text,enabled boolean,limit_value bigint)
     ), inserted as (
       insert into public.tenant_plan_entitlements (
         tenant_id,tenant_plan_id,entitlement_key,enabled,limit_value
       )
       select $1,$2,p.key,p.enabled,p.limit_value
       from payload p cross join owned_plan
       returning entitlement_key
     )
     select
       (select count(*) from owned_plan)::integer as owned_count,
       (select count(*) from inserted)::integer as inserted_count`,
    [
      tenantId,
      planId,
      JSON.stringify(payload.map((value) => ({
        key: value.key,
        kind: value.kind,
        enabled: value.enabled,
        limit_value: value.limitValue,
      }))),
    ],
  );
  if (Number(rows[0]?.["owned_count"] ?? 0) !== 1) {
    throw new Error("Plano não pertence ao tenant");
  }
}

export async function createStoreSubscription(
  sql: BillingSqlExecutor,
  scope: BillingScope,
  tenantPlanId: string,
  useTrial: boolean,
): Promise<string> {
  const rows = await sql.query(
    `insert into public.store_subscriptions (
       tenant_id,store_id,tenant_plan_id,status
     )
     select $1,$2,p.id,
       case when $4::boolean and p.trial_enabled then 'trialing' else 'active' end
     from public.tenant_plans p
     join public.stores s on s.tenant_id=p.tenant_id and s.id=$2
     where p.tenant_id=$1 and p.id=$3 and p.active=true
     returning id`,
    [scope.tenantId, scope.storeId, tenantPlanId, useTrial],
  );
  const row = rows[0];
  if (!row || typeof row["id"] !== "string") {
    throw new Error("Plano inativo/inexistente ou fora do tenant");
  }
  return row["id"];
}

const ALLOWED_TRANSITIONS: Readonly<Record<StoreSubscriptionStatus, readonly StoreSubscriptionStatus[]>> = {
  trialing: ["active", "suspended", "canceled", "expired"],
  active: ["past_due", "suspended", "canceled"],
  past_due: ["active", "suspended", "canceled"],
  suspended: ["active", "canceled"],
  canceled: [],
  expired: [],
};

export async function updateStoreSubscriptionStatus(
  sql: BillingSqlExecutor,
  scope: BillingScope,
  subscriptionId: string,
  nextStatus: StoreSubscriptionStatus,
): Promise<void> {
  const current = await sql.query(
    `select status from public.store_subscriptions
     where tenant_id=$1 and store_id=$2 and id=$3 limit 1`,
    [scope.tenantId, scope.storeId, subscriptionId],
  );
  const status = current[0]?.["status"];
  if (typeof status !== "string") throw new Error("Assinatura não encontrada");
  const allowed = ALLOWED_TRANSITIONS[status as StoreSubscriptionStatus];
  if (!allowed.includes(nextStatus)) throw new Error(`Transição de assinatura inválida: ${status} -> ${nextStatus}`);
  await sql.query(
    `update public.store_subscriptions set status=$4
     where tenant_id=$1 and store_id=$2 and id=$3`,
    [scope.tenantId, scope.storeId, subscriptionId, nextStatus],
  );
}
