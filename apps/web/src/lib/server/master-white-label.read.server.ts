import type { DomainType } from "@white-label/domains";
import type { DomainStatus, MasterWhiteLabelDetail, MasterWhiteLabelListResult, TenantStatus } from "./master-white-label.types.ts";
import { boolValue, nullableText, numberValue, objectValue, text, type AdminSql } from "./master-white-label.shared.server.ts";

export interface WhiteLabelListInput { search: string; status: "all" | TenantStatus; page: number; pageSize: number; }
export async function listWhiteLabels(sql: AdminSql, input: WhiteLabelListInput): Promise<MasterWhiteLabelListResult> {
  const offset = (input.page - 1) * input.pageSize;
  const rows = await sql.query(
    `select t.id::text,t.name,t.slug,t.status,t.created_at::text,
       owner.user_id::text as owner_user_id,owner.email as owner_email,
       (select count(*) from public.stores s where s.tenant_id=t.id)::integer as store_count,
       (select count(*) from public.domains d where d.tenant_id=t.id)::integer as domain_count,
       count(*) over()::integer as total_count
     from public.tenants t
     left join lateral (
       select tm.user_id,u.email from public.tenant_members tm left join auth.users u on u.id=tm.user_id
       where tm.tenant_id=t.id and tm.role='tenant_owner' order by tm.created_at asc limit 1
     ) owner on true
     where ($1='' or t.name ilike ('%' || $1 || '%') or t.slug ilike ('%' || $1 || '%'))
       and ($2='all' or t.status=$2)
     order by t.created_at desc,t.id desc limit $3 offset $4`,
    [input.search, input.status, input.pageSize, offset],
  );
  const total = rows.length ? numberValue(rows[0]!, "total_count") : 0;
  return {
    items: rows.map((row) => ({
      id: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"), status: text(row, "status") as TenantStatus,
      createdAt: text(row, "created_at"), ownerUserId: nullableText(row, "owner_user_id"), ownerEmail: nullableText(row, "owner_email"),
      storeCount: numberValue(row, "store_count"), domainCount: numberValue(row, "domain_count"),
    })), total, page: input.page, pageSize: input.pageSize, pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

async function detailRows(sql: AdminSql, tenantId: string) {
  return Promise.all([
    sql.query(`select t.id::text,t.name,t.slug,t.status,t.created_at::text,t.updated_at::text,t.trial_ends_at::text,b.logo_url,b.primary_color,coalesce(s.settings,'{}'::jsonb) as settings from public.tenants t left join public.tenant_branding b on b.tenant_id=t.id left join public.tenant_settings s on s.tenant_id=t.id where t.id=$1::uuid`, [tenantId]),
    sql.query(`select tm.user_id::text,u.email,tm.role,tm.created_at::text from public.tenant_members tm left join auth.users u on u.id=tm.user_id where tm.tenant_id=$1::uuid order by (tm.role='tenant_owner') desc,tm.created_at asc`, [tenantId]),
    sql.query(`select id::text,hostname,type,status,store_id::text,verified_at::text,created_at::text from public.domains where tenant_id=$1::uuid order by created_at desc`, [tenantId]),
    sql.query(`select tp.id::text,tp.slug,tp.name,pt.name as template_name,tp.active from public.tenant_plans tp join public.plan_templates pt on pt.id=tp.template_id where tp.tenant_id=$1::uuid order by tp.display_order,tp.created_at`, [tenantId]),
    sql.query(`select s.status,p.name as plan_name from public.subscriptions s left join public.plans p on p.id=s.plan_id where s.tenant_id=$1::uuid and s.level='platform_billing' order by s.created_at desc limit 1`, [tenantId]),
    sql.query(`select pt.id::text,pt.code,pt.name,pt.active,count(pte.entitlement_key)::integer as entitlement_count from public.plan_templates pt left join public.plan_template_entitlements pte on pte.template_id=pt.id group by pt.id,pt.code,pt.name,pt.active,pt.sort_order order by pt.sort_order,pt.code`, []),
  ]);
}
export async function getWhiteLabelDetail(sql: AdminSql, tenantId: string): Promise<MasterWhiteLabelDetail | null> {
  const [tenantRows, memberRows, domainRows, commercialPlanRows, subscriptionRows, templateRows] = await detailRows(sql, tenantId);
  const row = tenantRows[0]; if (!row) return null; const subscription = subscriptionRows[0];
  return {
    tenant: { id: text(row,"id"), name: text(row,"name"), slug: text(row,"slug"), status: text(row,"status") as TenantStatus, createdAt: text(row,"created_at"), updatedAt: text(row,"updated_at"), trialEndsAt: nullableText(row,"trial_ends_at"), logoUrl: nullableText(row,"logo_url"), primaryColor: nullableText(row,"primary_color"), settings: objectValue(row,"settings") },
    members: memberRows.map((m) => ({ userId: text(m,"user_id"), email: nullableText(m,"email"), role: text(m,"role"), createdAt: text(m,"created_at") })),
    domains: domainRows.map((d) => ({ id: text(d,"id"), hostname: text(d,"hostname"), type: text(d,"type") as DomainType, status: text(d,"status") as DomainStatus, storeId: nullableText(d,"store_id"), verifiedAt: nullableText(d,"verified_at"), createdAt: text(d,"created_at") })),
    commercialPlans: commercialPlanRows.map((p) => ({ id: text(p,"id"), slug: text(p,"slug"), name: text(p,"name"), templateName: text(p,"template_name"), active: boolValue(p,"active") })),
    platformSubscription: subscription ? { status: text(subscription,"status"), planName: nullableText(subscription,"plan_name") } : null,
    planTemplates: templateRows.map((t) => ({ id: text(t,"id"), code: text(t,"code"), name: text(t,"name"), active: boolValue(t,"active"), entitlementCount: numberValue(t,"entitlement_count") })),
  };
}
