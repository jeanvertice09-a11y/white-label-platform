import type { ControlSql } from "./control-merchants.shared.server.ts";

export interface ControlBrandingInput {
  name: string;
  logoUrl?: string | null;
  primaryColor: string | null;
}

export async function updateControlBranding(
  sql: ControlSql,
  tenantId: string,
  actorUserId: string,
  input: ControlBrandingInput,
): Promise<{ ok: true }> {
  const preserveLogo = input.logoUrl === undefined;
  const rows = await sql.query(
    `with tenant_update as (
       update public.tenants set name=$3,updated_at=now()
       where id=$1::uuid
       returning id,name
     ), branding_update as (
       insert into public.tenant_branding(tenant_id,logo_url,primary_color)
       select id,$4,$5 from tenant_update
       on conflict (tenant_id) do update
       set logo_url=case when $6::boolean then public.tenant_branding.logo_url else excluded.logo_url end,
           logo_asset_id=case when $6::boolean then public.tenant_branding.logo_asset_id else null end,
           primary_color=excluded.primary_color
       returning tenant_id,logo_url,primary_color
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $2::uuid,t.id,'control.branding.updated','tenant',t.id::text,
         jsonb_build_object('name',t.name,'logo_configured',b.logo_url is not null,'primary_color',b.primary_color)
       from tenant_update t join branding_update b on b.tenant_id=t.id
       returning id
     ) select id::text from tenant_update`,
    [tenantId, actorUserId, input.name, input.logoUrl ?? null, input.primaryColor, preserveLogo],
  );
  if (!rows[0]) throw new Error("White Label não encontrada.");
  return { ok: true };
}
