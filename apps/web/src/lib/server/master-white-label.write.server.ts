import { assertAllowedCustomHostname, normalizeAndValidateHostname, type DomainType } from "@white-label/domains";
import type { AdminSql } from "./master-white-label.shared.server.ts";
import { assertDomainScope, boolValue, hostnameTaken, nullableText, text } from "./master-white-label.shared.server.ts";
import type { TenantStatus } from "./master-white-label.types.ts";

export interface CreateWhiteLabelInput { name: string; slug: string; ownerUserId: string }
export interface UpdateWhiteLabelInput { tenantId: string; name: string; slug: string; logoUrl: string | null; primaryColor: string | null; settings: Record<string, unknown>; }

export async function createWhiteLabel(sql: AdminSql, actorUserId: string, input: CreateWhiteLabelInput) {
  const rows = await sql.query(
    `with valid_owner as (select id from auth.users where id=$3::uuid),
     inserted as (insert into public.tenants(name,slug,status) select $1,$2,'trial' from valid_owner on conflict (slug) do nothing returning id,name,slug,status,created_at),
     existing_retry as (select t.id,t.name,t.slug,t.status,t.created_at from public.tenants t join public.tenant_members tm on tm.tenant_id=t.id where t.slug=$2 and t.name=$1 and tm.user_id=$3::uuid and tm.role='tenant_owner'),
     target as (select i.*,true as created from inserted i union all select e.*,false from existing_retry e where not exists(select 1 from inserted) limit 1),
     branding as (insert into public.tenant_branding(tenant_id) select id from target on conflict do nothing returning tenant_id),
     settings as (insert into public.tenant_settings(tenant_id) select id from target on conflict do nothing returning tenant_id),
     owner_member as (insert into public.tenant_members(tenant_id,user_id,role) select id,$3::uuid,'tenant_owner' from target on conflict (tenant_id,user_id) do update set role='tenant_owner' returning tenant_id),
     audit as (insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata) select $4::uuid,id,'master.white_label.created','tenant',id::text,jsonb_build_object('slug',slug,'owner_user_id',$3::text) from target where created returning id)
     select id::text,name,slug,status,created_at::text,created from target`,
    [input.name, input.slug, input.ownerUserId, actorUserId],
  );
  if (rows[0]) return mapCreated(rows[0]);
  const retry = await exactRetry(sql, input); if (retry) return retry;
  const diagnosis = await sql.query(`select exists(select 1 from auth.users where id=$1::uuid) owner_exists,exists(select 1 from public.tenants where slug=$2) slug_exists`, [input.ownerUserId, input.slug]);
  if (diagnosis[0]?.["owner_exists"] !== true) throw new Error("Usuário owner não existe no Supabase Auth.");
  if (diagnosis[0]?.["slug_exists"] === true) throw new Error("Slug já pertence a outra White Label.");
  throw new Error("Não foi possível criar a White Label.");
}
function mapCreated(row: Record<string, unknown>) { return { id: text(row,"id"), name: text(row,"name"), slug: text(row,"slug"), status: text(row,"status") as TenantStatus, createdAt: text(row,"created_at"), created: boolValue(row,"created") }; }
async function exactRetry(sql: AdminSql, input: CreateWhiteLabelInput) {
  const rows = await sql.query(`select t.id::text,t.name,t.slug,t.status,t.created_at::text,false as created from public.tenants t join public.tenant_members tm on tm.tenant_id=t.id where t.slug=$1 and t.name=$2 and tm.user_id=$3::uuid and tm.role='tenant_owner' limit 1`, [input.slug,input.name,input.ownerUserId]);
  return rows[0] ? mapCreated(rows[0]) : null;
}

export async function updateWhiteLabel(sql: AdminSql, actorUserId: string, input: UpdateWhiteLabelInput) {
  const rows = await sql.query(
    `with target as (update public.tenants set name=$2,slug=$3,updated_at=now() where id=$1::uuid returning id,name,slug),
     branding as (insert into public.tenant_branding(tenant_id,logo_url,primary_color) select id,$4,$5 from target on conflict (tenant_id) do update set logo_url=excluded.logo_url,primary_color=excluded.primary_color returning tenant_id),
     settings as (insert into public.tenant_settings(tenant_id,settings,updated_at) select id,$6::jsonb,now() from target on conflict (tenant_id) do update set settings=excluded.settings,updated_at=now() returning tenant_id),
     audit as (insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata) select $7::uuid,id,'master.white_label.updated','tenant',id::text,jsonb_build_object('name',name,'slug',slug) from target returning id)
     select id::text from target`, [input.tenantId,input.name,input.slug,input.logoUrl,input.primaryColor,JSON.stringify(input.settings),actorUserId]);
  if (!rows[0]) throw new Error("White Label não encontrada."); return { ok: true };
}
export async function changeWhiteLabelOwner(sql: AdminSql, actorUserId: string, tenantId: string, ownerUserId: string) {
  const rows = await sql.query(
    `with target as (select id from public.tenants where id=$1::uuid),valid_owner as (select id,email from auth.users where id=$2::uuid),old_owner as (select user_id from public.tenant_members where tenant_id=$1::uuid and role='tenant_owner' limit 1),
     demoted as (update public.tenant_members set role='tenant_admin' where tenant_id=$1::uuid and role='tenant_owner' and user_id<>$2::uuid and exists(select 1 from target) and exists(select 1 from valid_owner) returning user_id),
     promoted as (insert into public.tenant_members(tenant_id,user_id,role) select t.id,v.id,'tenant_owner' from target t cross join valid_owner v cross join (select count(*) from demoted) guard on conflict (tenant_id,user_id) do update set role='tenant_owner' returning user_id),
     audit as (insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata) select $3::uuid,$1::uuid,'master.white_label.owner_changed','tenant',$1::uuid::text,jsonb_build_object('previous_owner_user_id',(select user_id::text from old_owner),'owner_user_id',(select user_id::text from promoted)) where exists(select 1 from promoted) and coalesce((select user_id from old_owner)::text,'')<>coalesce((select user_id from promoted)::text,'') returning id)
     select p.user_id::text,v.email from promoted p join valid_owner v on v.id=p.user_id`, [tenantId,ownerUserId,actorUserId]);
  if (!rows[0]) return diagnoseOwnerChange(sql,tenantId,ownerUserId);
  return { ownerUserId: text(rows[0],"user_id"), ownerEmail: nullableText(rows[0],"email") };
}
async function diagnoseOwnerChange(sql: AdminSql, tenantId: string, ownerUserId: string): Promise<never> {
  const rows = await sql.query(`select exists(select 1 from public.tenants where id=$1::uuid) tenant_exists,exists(select 1 from auth.users where id=$2::uuid) owner_exists`, [tenantId,ownerUserId]);
  if (rows[0]?.["tenant_exists"] !== true) throw new Error("White Label não encontrada.");
  if (rows[0]?.["owner_exists"] !== true) throw new Error("Usuário owner não existe no Supabase Auth.");
  throw new Error("Não foi possível alterar o owner.");
}
export async function setWhiteLabelStatus(sql: AdminSql, actorUserId: string, tenantId: string, status: "active" | "suspended") {
  const rows = await sql.query(`with current as (select id,status from public.tenants where id=$1::uuid),changed as (update public.tenants set status=$2,updated_at=now() where id=$1::uuid and status<>$2 returning id,status),audit as (insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata) select $3::uuid,c.id,case when $2='suspended' then 'master.white_label.suspended' else 'master.white_label.reactivated' end,'tenant',c.id::text,jsonb_build_object('from',c.status,'to',$2) from current c where exists(select 1 from changed) returning id) select c.id::text,coalesce(ch.status,c.status) status from current c left join changed ch on ch.id=c.id`, [tenantId,status,actorUserId]);
  if (!rows[0]) throw new Error("White Label não encontrada."); return { id: text(rows[0],"id"), status: text(rows[0],"status") as "active" | "suspended" };
}

export interface DomainInput { tenantId: string; hostname: string; type: DomainType; storeId: string | null }
export interface DomainUpdateInput extends DomainInput { domainId: string }
export async function createWhiteLabelDomain(sql: AdminSql, actorUserId: string, input: DomainInput) {
  assertDomainScope(input.type,input.storeId); const hostname=normalizeAndValidateHostname(input.hostname); assertAllowedCustomHostname(hostname);
  if (await hostnameTaken(sql,hostname)) throw new Error("Hostname já está cadastrado.");
  const rows=await sql.query(`with target as (insert into public.domains(tenant_id,store_id,hostname,type,status,verified_at,verification_token) select $1::uuid,$2::uuid,$3,$4,'pending',null,null where exists(select 1 from public.tenants where id=$1::uuid) and (($4 in ('tenant_panel','tenant_site') and $2::uuid is null) or ($4 in ('store_admin','store_catalog') and exists(select 1 from public.stores where id=$2::uuid and tenant_id=$1::uuid))) returning id,tenant_id,hostname,type,status,store_id,created_at),audit as (insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata) select $5::uuid,tenant_id,store_id,'master.domain.created','domain',id::text,jsonb_build_object('hostname',hostname,'type',type,'status',status) from target returning id) select id::text,hostname,status from target`,[input.tenantId,input.storeId,hostname,input.type,actorUserId]);
  if(!rows[0]) throw new Error("Escopo de domínio inválido para esta White Label/store."); return {id:text(rows[0],"id"),hostname,status:"pending" as const};
}
export async function updateWhiteLabelDomain(sql: AdminSql, actorUserId: string, input: DomainUpdateInput) {
  assertDomainScope(input.type,input.storeId); const hostname=normalizeAndValidateHostname(input.hostname); assertAllowedCustomHostname(hostname);
  if(await hostnameTaken(sql,hostname,input.domainId)) throw new Error("Hostname já está cadastrado.");
  const rows=await sql.query(`with valid_scope as (select 1 where ($4 in ('tenant_panel','tenant_site') and $3::uuid is null) or ($4 in ('store_admin','store_catalog') and exists(select 1 from public.stores where id=$3::uuid and tenant_id=$1::uuid))),target as (update public.domains d set hostname=$5,type=$4,store_id=$3::uuid,status='pending',verified_at=null,verification_token=null where d.id=$2::uuid and d.tenant_id=$1::uuid and exists(select 1 from valid_scope) returning d.id,d.tenant_id,d.store_id,d.hostname,d.type,d.status),audit as (insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata) select $6::uuid,tenant_id,store_id,'master.domain.updated','domain',id::text,jsonb_build_object('hostname',hostname,'type',type,'status',status) from target returning id) select id::text from target`,[input.tenantId,input.domainId,input.storeId,input.type,hostname,actorUserId]);
  if(!rows[0]) throw new Error("Domínio não encontrado ou escopo inválido."); return {ok:true};
}
export async function setWhiteLabelDomainStatus(sql: AdminSql,actorUserId:string,tenantId:string,domainId:string,status:"pending"|"suspended") {
  const rows=await sql.query(`with current as (select id,tenant_id,store_id,status from public.domains where id=$2::uuid and tenant_id=$1::uuid),changed as (update public.domains set status=$3 where id=$2::uuid and tenant_id=$1::uuid and status<>$3 returning id,status),audit as (insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata) select $4::uuid,c.tenant_id,c.store_id,'master.domain.status_changed','domain',c.id::text,jsonb_build_object('from',c.status,'to',$3) from current c where exists(select 1 from changed) returning id) select c.id::text,coalesce(ch.status,c.status) status from current c left join changed ch on ch.id=c.id`,[tenantId,domainId,status,actorUserId]);
  if(!rows[0]) throw new Error("Domínio não encontrado para esta White Label."); return {id:text(rows[0],"id"),status:text(rows[0],"status") as "pending"|"suspended"};
}
