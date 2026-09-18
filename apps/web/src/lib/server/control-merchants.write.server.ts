import type { ControlSql } from "./control-merchants.shared.server.ts";
import { nullableText, text } from "./control-merchants.shared.server.ts";
import type { ControlStoreStatus } from "./control-merchants.types.ts";

export interface CreateControlMerchantInput {
  name: string;
  slug: string;
  ownerEmail: string;
  planId: string | null;
  useTrial: boolean;
}

export interface UpdateControlMerchantInput {
  storeId: string;
  name: string;
  slug: string;
}

const CREATE_STORE_SQL = `with valid_owner as (
  select id,email from auth.users where lower(email)=lower($4) limit 1
), valid_plan as (
  select id,trial_enabled from public.tenant_plans
  where tenant_id=$1::uuid and id=$5::uuid and active=true
), permission as (
  select 1 from valid_owner
  where $5::uuid is null or exists(
    select 1 from valid_plan where $6::boolean=false or trial_enabled=true
  )
), inserted as (
  insert into public.stores(tenant_id,name,slug,status)
  select $1::uuid,$2,$3,'active' from permission
  on conflict (tenant_id,slug) do nothing
  returning id,tenant_id,name,slug,status,created_at
), existing_retry as (
  select s.id,s.tenant_id,s.name,s.slug,s.status,s.created_at
  from public.stores s
  join public.store_members sm on sm.tenant_id=s.tenant_id and sm.store_id=s.id
  join auth.users u on u.id=sm.user_id
  where s.tenant_id=$1::uuid and s.name=$2 and s.slug=$3
    and sm.role='store_owner' and lower(u.email)=lower($4)
    and (($5::uuid is null and not exists(
      select 1 from public.store_subscriptions ss
      where ss.tenant_id=s.tenant_id and ss.store_id=s.id
        and ss.status in ('trialing','active','past_due','suspended')
    )) or ($5::uuid is not null and exists(
      select 1 from public.store_subscriptions ss
      where ss.tenant_id=s.tenant_id and ss.store_id=s.id
        and ss.tenant_plan_id=$5::uuid
        and ss.status in ('trialing','active','past_due','suspended')
    )))
  limit 1
), target as (
  select i.*,true created from inserted i
  union all
  select e.*,false created from existing_retry e
  where not exists(select 1 from inserted)
  limit 1
), owner_member as (
  insert into public.store_members(tenant_id,store_id,user_id,role)
  select t.tenant_id,t.id,v.id,'store_owner'
  from target t cross join valid_owner v where t.created
  on conflict (store_id,user_id) do update set role='store_owner'
  returning store_id
), subscribed as (
  insert into public.store_subscriptions(tenant_id,store_id,tenant_plan_id,status)
  select t.tenant_id,t.id,p.id,
    case when $6::boolean and p.trial_enabled then 'trialing' else 'active' end
  from target t join valid_plan p on true
  where t.created and $5::uuid is not null and exists(select 1 from owner_member)
  returning id
), audit as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
  )
  select $7::uuid,t.tenant_id,t.id,'control.store.created','store',t.id::text,
    jsonb_build_object('slug',t.slug,'owner_email',$4,'plan_id',$5::text,'trial_requested',$6)
  from target t where t.created
  returning id
)
select t.id::text,t.name,t.slug,t.status,t.created_at::text,t.created from target t`;

async function diagnoseCreate(
  sql: ControlSql,
  tenantId: string,
  input: CreateControlMerchantInput,
): Promise<never> {
  const rows = await sql.query(
    `select
       exists(select 1 from auth.users where lower(email)=lower($2)) owner_exists,
       exists(select 1 from public.stores where tenant_id=$1::uuid and slug=$3) slug_exists,
       case when $4::uuid is null then true else exists(
         select 1 from public.tenant_plans
         where tenant_id=$1::uuid and id=$4::uuid and active=true
       ) end plan_exists,
       case when $4::uuid is null or $5::boolean=false then true else exists(
         select 1 from public.tenant_plans
         where tenant_id=$1::uuid and id=$4::uuid and active=true and trial_enabled=true
       ) end trial_allowed`,
    [tenantId, input.ownerEmail, input.slug, input.planId, input.useTrial],
  );
  const row = rows[0] ?? {};
  if (row["owner_exists"] !== true) throw new Error("Usuário responsável não existe no Supabase Auth.");
  if (row["plan_exists"] !== true) throw new Error("Plano inexistente, inativo ou fora desta White Label.");
  if (row["trial_allowed"] !== true) throw new Error("Trial não está habilitado para o plano selecionado.");
  if (row["slug_exists"] === true) throw new Error("Slug já pertence a outra loja desta White Label.");
  throw new Error("Não foi possível criar o lojista.");
}

export async function createControlMerchant(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  input: CreateControlMerchantInput,
) {
  const rows = await sql.query(CREATE_STORE_SQL, [
    tenantId,
    input.name,
    input.slug,
    input.ownerEmail,
    input.planId,
    input.useTrial,
    actorUserId,
  ]);
  const row = rows[0];
  if (!row) return diagnoseCreate(sql, tenantId, input);
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    slug: text(row, "slug"),
    status: text(row, "status") as ControlStoreStatus,
    createdAt: text(row, "created_at"),
    created: row["created"] === true,
  };
}

export async function updateControlMerchant(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  input: UpdateControlMerchantInput,
): Promise<{ ok: true }> {
  const rows = await sql.query(
    `with current as (
       select id,name,slug from public.stores where tenant_id=$1::uuid and id=$2::uuid
     ), changed as (
       update public.stores set name=$3,slug=$4,updated_at=now()
       where tenant_id=$1::uuid and id=$2::uuid returning id
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,$1::uuid,c.id,'control.store.updated','store',c.id::text,
         jsonb_build_object('from_name',c.name,'to_name',$3,'from_slug',c.slug,'to_slug',$4)
       from current c where exists(select 1 from changed) returning id
     )
     select id::text from changed`,
    [tenantId, input.storeId, input.name, input.slug, actorUserId],
  );
  if (!rows[0]) throw new Error("Loja não encontrada nesta White Label.");
  return { ok: true };
}

export async function changeControlMerchantOwner(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  ownerEmail: string,
): Promise<{ ownerUserId: string; ownerEmail: string | null }> {
  const rows = await sql.query(
    `with store as (
       select id,tenant_id from public.stores where tenant_id=$1::uuid and id=$2::uuid
     ), valid_owner as (
       select id,email from auth.users where lower(email)=lower($3) limit 1
     ), old_owner as (
       select user_id from public.store_members
       where tenant_id=$1::uuid and store_id=$2::uuid and role='store_owner'
       order by created_at,user_id limit 1
     ), demoted as (
       update public.store_members set role='store_admin'
       where tenant_id=$1::uuid and store_id=$2::uuid and role='store_owner'
         and user_id<>(select id from valid_owner)
         and exists(select 1 from store) and exists(select 1 from valid_owner)
       returning user_id
     ), promoted as (
       insert into public.store_members(tenant_id,store_id,user_id,role)
       select s.tenant_id,s.id,v.id,'store_owner' from store s cross join valid_owner v
       on conflict (store_id,user_id) do update set role='store_owner',tenant_id=excluded.tenant_id
       returning user_id
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $4::uuid,$1::uuid,$2::uuid,'control.store.owner_changed','store',$2::text,
         jsonb_build_object('previous_owner_user_id',(select user_id::text from old_owner),
                            'owner_user_id',(select user_id::text from promoted))
       where exists(select 1 from promoted)
         and coalesce((select user_id::text from old_owner),'')<>
             coalesce((select user_id::text from promoted),'')
       returning id
     )
     select p.user_id::text,v.email::text from promoted p join valid_owner v on v.id=p.user_id`,
    [tenantId, storeId, ownerEmail, actorUserId],
  );
  if (rows[0]) {
    return { ownerUserId: text(rows[0], "user_id"), ownerEmail: nullableText(rows[0], "email") };
  }
  return diagnoseOwner(sql, tenantId, storeId, ownerEmail);
}

async function diagnoseOwner(
  sql: ControlSql,
  tenantId: string,
  storeId: string,
  ownerEmail: string,
): Promise<never> {
  const rows = await sql.query(
    `select
       exists(select 1 from public.stores where tenant_id=$1::uuid and id=$2::uuid) store_exists,
       exists(select 1 from auth.users where lower(email)=lower($3)) owner_exists`,
    [tenantId, storeId, ownerEmail],
  );
  if (rows[0]?.["store_exists"] !== true) throw new Error("Loja não encontrada nesta White Label.");
  if (rows[0]?.["owner_exists"] !== true) throw new Error("Usuário responsável não existe no Supabase Auth.");
  throw new Error("Não foi possível alterar o responsável.");
}

export async function setControlMerchantStatus(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  status: "active" | "suspended",
): Promise<{ id: string; status: "active" | "suspended" }> {
  const rows = await sql.query(
    `with current as (
       select id,status from public.stores where tenant_id=$1::uuid and id=$2::uuid
     ), changed as (
       update public.stores set status=$3,updated_at=now()
       where tenant_id=$1::uuid and id=$2::uuid and status<>$3 returning id,status
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $4::uuid,$1::uuid,c.id,
         case when $3='suspended' then 'control.store.suspended' else 'control.store.reactivated' end,
         'store',c.id::text,jsonb_build_object('from',c.status,'to',$3)
       from current c where exists(select 1 from changed) returning id
     )
     select c.id::text,coalesce(ch.status,c.status) status
     from current c left join changed ch on ch.id=c.id`,
    [tenantId, storeId, status, actorUserId],
  );
  if (!rows[0]) throw new Error("Loja não encontrada nesta White Label.");
  return { id: text(rows[0], "id"), status: text(rows[0], "status") as "active" | "suspended" };
}
