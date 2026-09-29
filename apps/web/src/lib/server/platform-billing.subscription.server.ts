import type { AdminSql } from "./master-white-label.shared.server.ts";
import type { PlatformSubscriptionStatus } from "./platform-billing.types.ts";

export async function createPlatformSubscription(
  sql: AdminSql,
  actorUserId: string,
  tenantId: string,
  planId: string,
  now = new Date(),
): Promise<{ id: string; status: PlatformSubscriptionStatus; created: boolean }> {
  const rows = await sql.query(CREATE_SUBSCRIPTION_SQL, [
    tenantId,
    planId,
    actorUserId,
    now.toISOString(),
  ]);
  const row = rows.at(0);
  if (row) {
    return {
      id: requiredText(row, "id"),
      status: requiredText(row, "status") as PlatformSubscriptionStatus,
      created: row["created"] === true,
    };
  }
  return diagnoseSubscriptionCreate(sql, tenantId, planId);
}

async function diagnoseSubscriptionCreate(
  sql: AdminSql,
  tenantId: string,
  planId: string,
): Promise<never> {
  const rows = await sql.query(
    `select
       exists(select 1 from public.tenants where id=$1::uuid) tenant_exists,
       exists(select 1 from public.plans where id=$2::uuid and active=true) plan_exists,
       exists(select 1 from public.plans where id=$2::uuid and billing_interval is not null) interval_ready,
       exists(select 1 from public.subscriptions where tenant_id=$1::uuid and level='platform_billing'
         and status in ('trialing','active','past_due')) current_exists`,
    [tenantId, planId],
  );
  const row = rows.at(0) ?? {};
  if (row["tenant_exists"] !== true) throw new Error("White Label não encontrada.");
  if (row["plan_exists"] !== true) throw new Error("Plano Kataluu inexistente ou inativo.");
  if (row["interval_ready"] !== true) {
    throw new Error("Plano Kataluu sem intervalo de cobrança configurado.");
  }
  if (row["current_exists"] === true) {
    throw new Error("White Label já possui assinatura platform_billing atual.");
  }
  throw new Error("Não foi possível criar a assinatura platform_billing.");
}

export async function cancelPlatformSubscription(
  sql: AdminSql,
  actorUserId: string,
  subscriptionId: string,
): Promise<void> {
  const rows = await sql.query(
    `with changed as (
       update public.subscriptions
       set status='canceled',canceled_at=coalesce(canceled_at,now()),updated_at=now()
       where id=$1::uuid and level='platform_billing'
         and status in ('trialing','active','past_due')
       returning id,tenant_id
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $2::uuid,tenant_id,'billing.cancelled','subscription',id::text,'{}'::jsonb
       from changed returning id
     )
     select id::text from changed`,
    [subscriptionId, actorUserId],
  );
  if (!rows.at(0)) {
    throw new Error("Assinatura platform_billing não encontrada ou já encerrada.");
  }
}

export async function expireCanceledPlatformSubscription(
  sql: AdminSql,
  actorUserId: string,
  subscriptionId: string,
  now = new Date(),
): Promise<boolean> {
  const rows = await sql.query(
    `with changed as (
       update public.subscriptions
       set status='expired',updated_at=now()
       where id=$1::uuid and level='platform_billing' and status='canceled'
         and current_period_ends_at is not null and current_period_ends_at <= $3::timestamptz
       returning id,tenant_id
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $2::uuid,tenant_id,'subscription.expired','subscription',id::text,'{}'::jsonb
       from changed returning id
     )
     select id::text from changed`,
    [subscriptionId, actorUserId, now.toISOString()],
  );
  return Boolean(rows.at(0));
}

function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Campo inválido: ${key}`);
  }
  return value;
}

const CREATE_SUBSCRIPTION_SQL = `with target as (
  select t.id as tenant_id,t.status as tenant_status,t.trial_ends_at,
    p.id as plan_id,p.billing_interval
  from public.tenants t cross join public.plans p
  where t.id=$1::uuid and p.id=$2::uuid and p.active=true
    and p.billing_interval is not null
), current as (
  select s.id,s.status,s.plan_id from public.subscriptions s
  where s.tenant_id=$1::uuid and s.level='platform_billing'
    and s.status in ('trialing','active','past_due')
  order by s.created_at desc limit 1
), inserted as (
  insert into public.subscriptions(
    level,tenant_id,plan_id,status,started_at,trial_started_at,trial_ends_at,updated_at
  )
  select 'platform_billing',tenant_id,plan_id,
    case when tenant_status='trial' and trial_ends_at>$4::timestamptz
      then 'trialing' else 'past_due' end,
    $4::timestamptz,
    case when tenant_status='trial' and trial_ends_at>$4::timestamptz
      then $4::timestamptz else null end,
    case when tenant_status='trial' and trial_ends_at>$4::timestamptz
      then trial_ends_at else null end,
    now()
  from target where not exists(select 1 from current)
  returning id,status,plan_id,tenant_id
), exact_retry as (
  select c.id,c.status,c.plan_id,$1::uuid as tenant_id
  from current c where c.plan_id=$2::uuid and not exists(select 1 from inserted)
), chosen as (
  select id,status,plan_id,tenant_id,true as created from inserted
  union all
  select id,status,plan_id,tenant_id,false from exact_retry
), audit as (
  insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
  select $3::uuid,tenant_id,'subscription.created','subscription',id::text,
    jsonb_build_object('level','platform_billing','plan_id',plan_id::text,'status',status)
  from chosen where created returning id
)
select id::text,status,created from chosen limit 1`;
