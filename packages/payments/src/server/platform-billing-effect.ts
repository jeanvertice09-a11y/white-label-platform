import type { PaymentStatus } from "../types.ts";
import type { PaymentSql } from "./webhook-store.ts";

const EFFECT_STATUSES: readonly PaymentStatus[] = [
  "captured",
  "failed",
  "refunded",
  "chargeback",
];

export async function applyPlatformBillingEffect(
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
  set platform_effect_status=$2,updated_at=now()
  where pay.id=$1::uuid and pay.level='platform_billing'
    and pay.subscription_id is not null and pay.status=$2
    and pay.platform_effect_status is distinct from $2
    and exists (
      select 1 from public.subscriptions s
      join public.plans p on p.id=s.plan_id and p.billing_interval is not null
      where s.id=pay.subscription_id and s.tenant_id=pay.tenant_id
        and s.level='platform_billing'
    )
  returning pay.id,pay.tenant_id,pay.subscription_id,pay.status as payment_status
), changed as (
  update public.subscriptions s
  set status=case
      when m.payment_status='captured' then 'active'
      when m.payment_status in ('failed','refunded','chargeback') then 'past_due'
      else s.status
    end,
    current_period_started_at=case
      when m.payment_status='captured'
        then greatest(coalesce(s.current_period_ends_at,now()),now())
      else s.current_period_started_at
    end,
    current_period_ends_at=case
      when m.payment_status='captured' and p.billing_interval='monthly'
        then greatest(coalesce(s.current_period_ends_at,now()),now())+interval '1 month'
      when m.payment_status='captured' and p.billing_interval='quarterly'
        then greatest(coalesce(s.current_period_ends_at,now()),now())+interval '3 months'
      when m.payment_status='captured' and p.billing_interval='yearly'
        then greatest(coalesce(s.current_period_ends_at,now()),now())+interval '1 year'
      else s.current_period_ends_at
    end,
    updated_at=now()
  from marked m,public.plans p
  where s.id=m.subscription_id and s.tenant_id=m.tenant_id
    and p.id=s.plan_id and s.level='platform_billing'
    and s.status not in ('canceled','expired')
  returning s.id,s.tenant_id,s.status,m.payment_status
), audit as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,action,resource_type,resource_id,metadata
  )
  select null,tenant_id,
    case when payment_status='captured'
      then 'billing.payment_confirmed' else 'billing.payment_failed' end,
    'subscription',id::text,
    jsonb_build_object('payment_status',payment_status,'level','platform_billing')
  from changed returning id
)
select exists(select 1 from changed) changed`;
