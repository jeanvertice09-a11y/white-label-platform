import { randomBytes } from "node:crypto";
import { assertAllowedCustomHostname, normalizeDomainRegistrationInput, type DomainType } from "@white-label/domains";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import type { ControlDomainInput, ControlDomainUpdateInput } from "./control-domains.types.ts";

function challengeToken(): string {
  return randomBytes(24).toString("hex");
}

function assertScope(type: DomainType, storeId: string | null): void {
  const storeDomain = type === "store_admin" || type === "store_catalog";
  if (storeDomain && !storeId) throw new Error("Domínio de loja exige uma loja.");
  if (!storeDomain && storeId) throw new Error("Domínio da White Label não pode receber loja.");
}

async function assertHostnameFree(
  sql: ControlSql,
  hostname: string,
  ignoreDomainId: string | null,
): Promise<void> {
  const rows = await sql.query(
    `select exists(select 1 from public.domains
      where hostname=$1 and ($2::uuid is null or id<>$2::uuid)) taken`,
    [hostname, ignoreDomainId],
  );
  if (rows[0]?.["taken"] === true) throw new Error("Hostname já está cadastrado.");
}

export async function createControlDomain(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  input: ControlDomainInput,
) {
  assertScope(input.type, input.storeId);
  const hostname = assertAllowedCustomHostname(normalizeDomainRegistrationInput(input.hostname));
  await assertHostnameFree(sql, hostname, null);
  const token = challengeToken();
  const rows = await sql.query(
    `with target as (
       insert into public.domains(tenant_id,store_id,hostname,type,status,verified_at,verification_token)
       select $1::uuid,$2::uuid,$3,$4,'pending',null,$5
       where (($4 in ('tenant_panel','tenant_site') and $2::uuid is null)
          or ($4 in ('store_admin','store_catalog') and exists(
            select 1 from public.stores where tenant_id=$1::uuid and id=$2::uuid
          )))
       returning id,tenant_id,store_id,hostname,type,status
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $6::uuid,tenant_id,store_id,'control.domain.created','domain',id::text,
         jsonb_build_object('hostname',hostname,'type',type,'status',status)
       from target returning id
     ) select id::text,hostname,status from target`,
    [tenantId, input.storeId, hostname, input.type, token, actorUserId],
  );
  if (!rows[0]) throw new Error("Escopo de domínio inválido para esta White Label/loja.");
  return { id: String(rows[0]["id"]), hostname, status: "pending" as const };
}

export async function updateControlDomain(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  input: ControlDomainUpdateInput,
): Promise<{ ok: true }> {
  assertScope(input.type, input.storeId);
  const hostname = assertAllowedCustomHostname(normalizeDomainRegistrationInput(input.hostname));
  await assertHostnameFree(sql, hostname, input.domainId);
  const token = challengeToken();
  const rows = await sql.query(
    `with valid_scope as (
       select 1 where ($4 in ('tenant_panel','tenant_site') and $3::uuid is null)
       or ($4 in ('store_admin','store_catalog') and exists(
         select 1 from public.stores where tenant_id=$1::uuid and id=$3::uuid
       ))
     ), target as (
       update public.domains set hostname=$5,type=$4,store_id=$3::uuid,status='pending',
         verified_at=null,verification_token=$6
       where tenant_id=$1::uuid and id=$2::uuid and exists(select 1 from valid_scope)
       returning id,tenant_id,store_id,hostname,type,status
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $7::uuid,tenant_id,store_id,'control.domain.updated','domain',id::text,
         jsonb_build_object('hostname',hostname,'type',type,'status',status)
       from target returning id
     ) select id::text from target`,
    [tenantId, input.domainId, input.storeId, input.type, hostname, token, actorUserId],
  );
  if (!rows[0]) throw new Error("Domínio não encontrado ou escopo inválido.");
  return { ok: true };
}

export async function setControlDomainStatus(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  domainId: string,
  status: "pending" | "suspended",
) {
  const token = challengeToken();
  const rows = await sql.query(
    `with current as (
       select id,tenant_id,store_id,status from public.domains
       where tenant_id=$1::uuid and id=$2::uuid
     ), changed as (
       update public.domains set status=$3,
         verified_at=case when $3='pending' then null else verified_at end,
         verification_token=case when $3='pending' then $5 else verification_token end
       where tenant_id=$1::uuid and id=$2::uuid and status<>$3
       returning id,status
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $4::uuid,c.tenant_id,c.store_id,
         case when $3='suspended' then 'control.domain.suspended' else 'control.domain.reopened' end,
         'domain',c.id::text,jsonb_build_object('from',c.status,'to',$3)
       from current c where exists(select 1 from changed) returning id
     ) select c.id::text,coalesce(ch.status,c.status) status
       from current c left join changed ch on ch.id=c.id`,
    [tenantId, domainId, status, actorUserId, token],
  );
  if (!rows[0]) throw new Error("Domínio não encontrado nesta White Label.");
  return { id: String(rows[0]["id"]), status: String(rows[0]["status"]) };
}

export async function deleteControlDomain(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  domainId: string,
): Promise<{ ok: true }> {
  const rows = await sql.query(
    `with removed as (
       delete from public.domains where tenant_id=$1::uuid and id=$2::uuid
       returning id,tenant_id,store_id,hostname,type,status
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $3::uuid,tenant_id,store_id,'control.domain.removed','domain',id::text,
         jsonb_build_object('hostname',hostname,'type',type,'status',status)
       from removed returning id
     ) select id::text from removed`,
    [tenantId, domainId, actorUserId],
  );
  if (!rows[0]) throw new Error("Domínio não encontrado nesta White Label.");
  return { ok: true };
}
