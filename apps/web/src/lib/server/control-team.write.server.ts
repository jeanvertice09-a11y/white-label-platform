import type { StoreRole, TenantRole } from "@white-label/auth";
import type { ControlTeamSql } from "./control-team.shared.server.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

async function diagnoseTenantMutation(
  sql: ControlTeamSql,
  tenantId: string,
  emailOrUserId: string,
  actorIsOwner: boolean,
  desiredRole?: TenantRole,
): Promise<never> {
  const byEmail = desiredRole !== undefined;
  const rows = await sql.query(
    `select
       exists(select 1 from auth.users where ${byEmail ? "lower(email)=lower($2)" : "id=$2::uuid"}) user_exists,
       (select role from public.tenant_members where tenant_id=$1::uuid and user_id=(
          select id from auth.users where ${byEmail ? "lower(email)=lower($2)" : "id=$2::uuid"} limit 1
        )) current_role,
       (select count(*)::int from public.tenant_members where tenant_id=$1::uuid and role='tenant_owner') owner_count`,
    [tenantId, emailOrUserId],
  );
  const row = rows.at(0) ?? {};
  if (row["user_exists"] !== true) throw new Error("Usuário não existe no Supabase Auth.");
  const currentRole = typeof row["current_role"] === "string" ? row["current_role"] : null;
  if (!actorIsOwner && (desiredRole === "tenant_owner" || currentRole === "tenant_owner")) {
    throw new Error("Somente tenant_owner pode administrar outro tenant_owner.");
  }
  if (currentRole === "tenant_owner" && desiredRole !== "tenant_owner" && Number(row["owner_count"] ?? 0) <= 1) {
    throw new Error("A White Label precisa manter pelo menos um tenant_owner.");
  }
  if (desiredRole === undefined && currentRole === null) throw new Error("Membership não encontrada nesta White Label.");
  throw new Error("Não foi possível alterar a membership.");
}

export async function upsertTenantMember(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  actorIsOwner: boolean,
  email: string,
  role: TenantRole,
): Promise<{ userId: string; role: TenantRole }> {
  const rows = await sql.query(
    `with target_user as (
       select id from auth.users where lower(email)=lower($2) limit 1
     ), current as (
       select tm.user_id,tm.role from public.tenant_members tm
       join target_user u on u.id=tm.user_id
       where tm.tenant_id=$1::uuid
     ), eligible as (
       select u.id from target_user u
       where ($4::boolean or $3<>'tenant_owner')
         and ($4::boolean or coalesce((select role from current),'')<>'tenant_owner')
         and not (
           coalesce((select role from current),'')='tenant_owner'
           and $3<>'tenant_owner'
           and (select count(*) from public.tenant_members
                where tenant_id=$1::uuid and role='tenant_owner')<=1
         )
     ), changed as (
       insert into public.tenant_members(tenant_id,user_id,role)
       select $1::uuid,id,$3 from eligible
       on conflict (tenant_id,user_id) do update set role=excluded.role
       returning user_id,role
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $5::uuid,$1::uuid,'control.team.tenant_member_saved','tenant_member',
              c.user_id::text,jsonb_build_object('role',c.role)
       from changed c returning id
     )
     select user_id::text,role from changed`,
    [tenantId, email, role, actorIsOwner, actorUserId],
  );
  const row = rows.at(0);
  if (!row) return diagnoseTenantMutation(sql, tenantId, email, actorIsOwner, role);
  return { userId: text(row, "user_id"), role: text(row, "role") as TenantRole };
}

export async function removeTenantMember(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  actorIsOwner: boolean,
  userId: string,
): Promise<{ ok: true }> {
  const rows = await sql.query(
    `with current as (
       select user_id,role from public.tenant_members
       where tenant_id=$1::uuid and user_id=$2::uuid
     ), eligible as (
       select user_id from current
       where ($3::boolean or role<>'tenant_owner')
         and not (
           role='tenant_owner'
           and (select count(*) from public.tenant_members
                where tenant_id=$1::uuid and role='tenant_owner')<=1
         )
     ), removed as (
       delete from public.tenant_members
       where tenant_id=$1::uuid and user_id in (select user_id from eligible)
       returning user_id,role
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $4::uuid,$1::uuid,'control.team.tenant_member_removed','tenant_member',
              r.user_id::text,jsonb_build_object('role',r.role)
       from removed r returning id
     )
     select user_id::text from removed`,
    [tenantId, userId, actorIsOwner, actorUserId],
  );
  if (!rows.at(0)) return diagnoseTenantMutation(sql, tenantId, userId, actorIsOwner);
  return { ok: true };
}

async function diagnoseStoreMutation(
  sql: ControlTeamSql,
  tenantId: string,
  storeId: string,
  emailOrUserId: string,
  byEmail: boolean,
): Promise<never> {
  const userCondition = byEmail ? "lower(email)=lower($3)" : "id=$3::uuid";
  const rows = await sql.query(
    `select
       exists(select 1 from public.stores where tenant_id=$1::uuid and id=$2::uuid) store_exists,
       exists(select 1 from auth.users where ${userCondition}) user_exists,
       (select role from public.store_members where tenant_id=$1::uuid and store_id=$2::uuid
        and user_id=(select id from auth.users where ${userCondition} limit 1)) current_role`,
    [tenantId, storeId, emailOrUserId],
  );
  const row = rows.at(0) ?? {};
  if (row["store_exists"] !== true) throw new Error("Loja não encontrada nesta White Label.");
  if (row["user_exists"] !== true) throw new Error("Usuário não existe no Supabase Auth.");
  if (row["current_role"] === "store_owner") {
    throw new Error("O store_owner deve ser alterado pelo fluxo dedicado de responsável da loja.");
  }
  if (!byEmail && typeof row["current_role"] !== "string") throw new Error("Membership da loja não encontrada.");
  throw new Error("Não foi possível alterar o acesso da loja.");
}

export async function upsertStoreMember(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  email: string,
  role: Exclude<StoreRole, "store_owner">,
): Promise<{ userId: string; role: StoreRole }> {
  const rows = await sql.query(
    `with store as (
       select id,tenant_id from public.stores where tenant_id=$1::uuid and id=$2::uuid
     ), target_user as (
       select id from auth.users where lower(email)=lower($3) limit 1
     ), current as (
       select role from public.store_members sm join target_user u on u.id=sm.user_id
       where sm.tenant_id=$1::uuid and sm.store_id=$2::uuid
     ), changed as (
       insert into public.store_members(tenant_id,store_id,user_id,role)
       select s.tenant_id,s.id,u.id,$4 from store s cross join target_user u
       where coalesce((select role from current),'')<>'store_owner'
       on conflict (store_id,user_id) do update set role=excluded.role,tenant_id=excluded.tenant_id
       returning user_id,role
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,$1::uuid,$2::uuid,'control.team.store_member_saved','store_member',
              c.user_id::text,jsonb_build_object('role',c.role)
       from changed c returning id
     )
     select user_id::text,role from changed`,
    [tenantId, storeId, email, role, actorUserId],
  );
  const row = rows.at(0);
  if (!row) return diagnoseStoreMutation(sql, tenantId, storeId, email, true);
  return { userId: text(row, "user_id"), role: text(row, "role") as StoreRole };
}

export async function removeStoreMember(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  userId: string,
): Promise<{ ok: true }> {
  const rows = await sql.query(
    `with removed as (
       delete from public.store_members
       where tenant_id=$1::uuid and store_id=$2::uuid and user_id=$3::uuid
         and role<>'store_owner'
       returning user_id,role
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $4::uuid,$1::uuid,$2::uuid,'control.team.store_member_removed','store_member',
              r.user_id::text,jsonb_build_object('role',r.role)
       from removed r returning id
     )
     select user_id::text from removed`,
    [tenantId, storeId, userId, actorUserId],
  );
  if (!rows.at(0)) return diagnoseStoreMutation(sql, tenantId, storeId, userId, false);
  return { ok: true };
}
