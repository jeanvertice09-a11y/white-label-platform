import type { PaymentStatus } from "../types.ts";
import type { PaymentSql } from "./webhook-store.ts";

const EFFECT_STATUSES: readonly PaymentStatus[] = [
  "captured",
  "failed",
  "refunded",
  "chargeback",
];

export async function applyTenantBillingEffect(
  sql: PaymentSql,
  paymentId: string,
  status: PaymentStatus,
): Promise<boolean> {
  if (!EFFECT_STATUSES.includes(status)) return false;
  const rows = await sql.query(EFFECT_SQL, [paymentId, status]);
  return rows.at(0)?.["changed"] === true;
}

const EFFECT_SQL = `with marked as (
  update public.payments pay
  set tenant_effect_status=$2,updated_at=now()
  where pay.id=$1::uuid and pay.level='tenant_billing'
    and pay.store_id is not null and pay.store_subscription_id is not null
    and pay.status=$2 and pay.tenant_effect_status is distinct from $2
    and exists (
      select 1 from public.store_subscriptions s
      join public.tenant_plans p
        on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
      where s.id=pay.store_subscription_id
        and s.tenant_id=pay.tenant_id and s.store_id=pay.store_id
    )
  returning pay.id,pay.tenant_id,pay.store_id,pay.store_subscription_id,
    pay.status as payment_status
), changed as (
  update public.store_subscriptions s
  set status=case
      when m.payment_status='captured' and s.status in ('trialing','active','past_due') then 'active'
      when m.payment_status in ('failed','refunded','chargeback')
        and s.status in ('trialing','active','past_due') then 'past_due'
      else s.status
    end,
    current_period_started_at=case
      when m.payment_status='captured' and s.status in ('trialing','active','past_due')
        then greatest(coalesce(s.current_period_ends_at,now()),now())
      else s.current_period_started_at
    end,
    current_period_ends_at=case
      when m.payment_status='captured' and s.status in ('trialing','active','past_due')
        and p.billing_interval='monthly'
        then greatest(coalesce(s.current_period_ends_at,now()),now())+interval '1 month'
      when m.payment_status='captured' and s.status in ('trialing','active','past_due')
        and p.billing_interval='quarterly'
        then greatest(coalesce(s.current_period_ends_at,now()),now())+interval '3 months'
      when m.payment_status='captured' and s.status in ('trialing','active','past_due')
        and p.billing_interval='yearly'
        then greatest(coalesce(s.current_period_ends_at,now()),now())+interval '1 year'
      else s.current_period_ends_at
    end,
    updated_at=now()
  from marked m,public.tenant_plans p
  where s.id=m.store_subscription_id
    and s.tenant_id=m.tenant_id and s.store_id=m.store_id
    and p.id=s.tenant_plan_id and p.tenant_id=s.tenant_id
    and s.status not in ('suspended','canceled','expired')
  returning s.id,s.tenant_id,s.store_id,s.status,m.payment_status
), audit as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
  )
  select null,tenant_id,store_id,
    case when payment_status='captured'
      then 'tenant_billing.payment_confirmed' else 'tenant_billing.payment_failed' end,
    'store_subscription',id::text,
    jsonb_build_object('payment_status',payment_status,'level','tenant_billing')
  from changed returning id
)
select exists(select 1 from changed) changed`;
