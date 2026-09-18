import type { ControlSql } from "./control-merchants.shared.server.ts";
import { nullableText, text } from "./control-merchants.shared.server.ts";
import type { ControlSubscriptionStatus } from "./control-merchants.types.ts";

export async function assignControlMerchantPlan(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  planId: string,
  useTrial: boolean,
): Promise<{ subscriptionId: string; status: ControlSubscriptionStatus }> {
  const rows = await sql.query(
    `with store as (
       select id from public.stores where tenant_id=$1::uuid and id=$2::uuid
     ), plan as (
       select id,trial_enabled from public.tenant_plans
       where tenant_id=$1::uuid and id=$3::uuid and active=true
         and ($4::boolean=false or trial_enabled=true)
     ), current as (
       select id,tenant_plan_id,status from public.store_subscriptions
       where tenant_id=$1::uuid and store_id=$2::uuid
         and status in ('trialing','active','past_due','suspended') limit 1
     ), canceled as (
       update public.store_subscriptions set status='canceled'
       where id=(select id from current)
         and (select tenant_plan_id from current)<>(select id from plan)
       returning id
     ), created as (
       insert into public.store_subscriptions(tenant_id,store_id,tenant_plan_id,status)
       select $1::uuid,s.id,p.id,
         case when $4::boolean and p.trial_enabled then 'trialing' else 'active' end
       from store s cross join plan p
       where not exists(select 1 from current where tenant_plan_id=p.id)
         and (not exists(select 1 from current) or exists(select 1 from canceled))
       returning id,status
     ), result as (
       select id,status from created
       union all
       select c.id,c.status from current c
       join plan p on p.id=c.tenant_plan_id
       where not exists(select 1 from created) limit 1
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,$1::uuid,$2::uuid,'control.store.plan_changed','store',$2::text,
         jsonb_build_object('tenant_plan_id',$3::text,'subscription_id',r.id::text,'status',r.status)
       from result r
       where exists(select 1 from created) or exists(select 1 from canceled)
       returning id
     )
     select id::text,status from result`,
    [tenantId, storeId, planId, useTrial, actorUserId],
  );
  if (!rows[0]) throw new Error("Loja/plano inválido, plano fora do tenant ou trial indisponível.");
  return {
    subscriptionId: text(rows[0], "id"),
    status: text(rows[0], "status") as ControlSubscriptionStatus,
  };
}

const TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  trialing: ["active", "suspended", "canceled", "expired"],
  active: ["past_due", "suspended", "canceled"],
  past_due: ["active", "suspended", "canceled"],
  suspended: ["active", "canceled"],
  canceled: [],
  expired: [],
};

export async function setControlSubscriptionStatus(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  subscriptionId: string,
  nextStatus: Exclude<ControlSubscriptionStatus, "trialing">,
): Promise<{ status: ControlSubscriptionStatus }> {
  const current = await sql.query(
    `select status from public.store_subscriptions
     where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid`,
    [tenantId, storeId, subscriptionId],
  );
  const currentStatus = nullableText(current[0] ?? {}, "status");
  if (!currentStatus) throw new Error("Assinatura não encontrada nesta loja/White Label.");
  if (currentStatus === nextStatus) return { status: nextStatus };
  if (!(TRANSITIONS[currentStatus] ?? []).includes(nextStatus)) {
    throw new Error(`Transição de assinatura inválida: ${currentStatus} -> ${nextStatus}`);
  }
  const rows = await sql.query(
    `with changed as (
       update public.store_subscriptions set status=$4
       where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid
       returning id,status
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,$1::uuid,$2::uuid,'control.store.subscription_status_changed',
         'store_subscription',id::text,jsonb_build_object('from',$6,'to',status)
       from changed returning id
     )
     select status from changed`,
    [tenantId, storeId, subscriptionId, nextStatus, actorUserId, currentStatus],
  );
  if (!rows[0]) throw new Error("Assinatura não encontrada nesta loja/White Label.");
  return { status: text(rows[0], "status") as ControlSubscriptionStatus };
}
