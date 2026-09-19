import type { DomainType } from "@white-label/domains";
import type {
  DomainStatus,
  MasterWhiteLabelDetail,
  MasterWhiteLabelListResult,
  TenantStatus,
} from "./master-white-label.types.ts";
import {
  boolValue,
  nullableText,
  numberValue,
  objectValue,
  text,
  type AdminSql,
} from "./master-white-label.shared.server.ts";
import {
  getPlatformBillingSnapshot,
  listPlatformPlans,
} from "./platform-billing.read.server.ts";

type Row = Record<string, unknown>;
type DetailRows = [Row[], Row[], Row[], Row[], Row[], Row[], Row[]];

export interface WhiteLabelListInput {
  search: string;
  status: "all" | TenantStatus;
  page: number;
  pageSize: number;
}

export async function listWhiteLabels(
  sql: AdminSql,
  input: WhiteLabelListInput,
): Promise<MasterWhiteLabelListResult> {
  const offset = (input.page - 1) * input.pageSize;
  const rows = await sql.query(LIST_SQL, [input.search, input.status, input.pageSize, offset]);
  const total = rows.at(0) ? numberValue(rows[0] ?? {}, "total_count") : 0;
  return {
    items: rows.map(mapListItem), total, page: input.page, pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

function mapListItem(row: Row): MasterWhiteLabelListResult["items"][number] {
  return {
    id: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"),
    status: text(row, "status") as TenantStatus, createdAt: text(row, "created_at"),
    ownerUserId: nullableText(row, "owner_user_id"), ownerEmail: nullableText(row, "owner_email"),
    storeCount: numberValue(row, "store_count"), domainCount: numberValue(row, "domain_count"),
  };
}

async function detailRows(sql: AdminSql, tenantId: string): Promise<DetailRows> {
  return Promise.all([
    sql.query(`select t.id::text,t.name,t.slug,t.status,t.created_at::text,t.updated_at::text,
      t.trial_ends_at::text,b.logo_url,b.primary_color,coalesce(s.settings,'{}'::jsonb) as settings
      from public.tenants t left join public.tenant_branding b on b.tenant_id=t.id
      left join public.tenant_settings s on s.tenant_id=t.id where t.id=$1::uuid`, [tenantId]),
    sql.query(`select tm.user_id::text,u.email,tm.role,tm.created_at::text
      from public.tenant_members tm left join auth.users u on u.id=tm.user_id
      where tm.tenant_id=$1::uuid order by (tm.role='tenant_owner') desc,tm.created_at asc`, [tenantId]),
    sql.query(`select id::text,hostname,type,status,store_id::text,verified_at::text,created_at::text
      from public.domains where tenant_id=$1::uuid order by created_at desc`, [tenantId]),
    sql.query(`select tp.id::text,tp.slug,tp.name,pt.name as template_name,tp.active
      from public.tenant_plans tp join public.plan_templates pt on pt.id=tp.template_id
      where tp.tenant_id=$1::uuid order by tp.display_order,tp.created_at`, [tenantId]),
    sql.query(`select pt.id::text,pt.code,pt.name,pt.active,count(pte.entitlement_key)::integer as entitlement_count
      from public.plan_templates pt left join public.plan_template_entitlements pte on pte.template_id=pt.id
      group by pt.id,pt.code,pt.name,pt.active,pt.sort_order order by pt.sort_order,pt.code`, []),
    sql.query(`select st.id::text,st.name,st.slug,st.status,st.created_at::text,
      owner.user_id::text owner_user_id,owner.email owner_email,
      (select count(*) from public.store_members sm where sm.tenant_id=st.tenant_id and sm.store_id=st.id)::integer member_count
      from public.stores st
      left join lateral (
        select sm.user_id,u.email from public.store_members sm left join auth.users u on u.id=sm.user_id
        where sm.tenant_id=st.tenant_id and sm.store_id=st.id and sm.role='store_owner'
        order by sm.created_at asc limit 1
      ) owner on true
      where st.tenant_id=$1::uuid order by st.created_at desc`, [tenantId]),
    sql.query(`select id::text,action,resource_type,resource_id::text,actor_user_id::text,created_at::text
      from public.audit_logs where tenant_id=$1::uuid order by created_at desc limit 50`, [tenantId]),
  ]);
}

export async function getWhiteLabelDetail(
  sql: AdminSql,
  tenantId: string,
): Promise<MasterWhiteLabelDetail | null> {
  const [baseRows, platformBilling, platformPlans] = await Promise.all([
    detailRows(sql, tenantId), getPlatformBillingSnapshot(sql, tenantId), listPlatformPlans(sql),
  ]);
  const tenant = baseRows[0].at(0);
  if (!tenant) return null;
  return buildDetail(baseRows, tenant, platformBilling, platformPlans);
}

function buildDetail(
  rows: DetailRows,
  tenant: Row,
  platformBilling: MasterWhiteLabelDetail["platformBilling"],
  platformPlans: MasterWhiteLabelDetail["platformPlans"],
): MasterWhiteLabelDetail {
  return {
    tenant: mapTenant(tenant),
    members: rows[1].map(mapMember),
    domains: rows[2].map(mapDomain),
    commercialPlans: rows[3].map(mapCommercialPlan),
    platformSubscription: platformBilling?.subscriptionId
      ? { status: platformBilling.subscriptionStatus ?? "", planName: platformBilling.planName }
      : null,
    platformBilling,
    platformPlans,
    planTemplates: rows[4].map(mapTemplate),
    stores: rows[5].map(mapStore),
    audits: rows[6].map(mapAudit),
  };
}

function mapTenant(row: Row): MasterWhiteLabelDetail["tenant"] {
  return {
    id: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"),
    status: text(row, "status") as TenantStatus, createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"), trialEndsAt: nullableText(row, "trial_ends_at"),
    logoUrl: nullableText(row, "logo_url"), primaryColor: nullableText(row, "primary_color"),
    settings: objectValue(row, "settings"),
  };
}

function mapMember(row: Row): MasterWhiteLabelDetail["members"][number] {
  return { userId: text(row, "user_id"), email: nullableText(row, "email"), role: text(row, "role"), createdAt: text(row, "created_at") };
}
function mapStore(row: Row): MasterWhiteLabelDetail["stores"][number] {
  return {
    id: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"), status: text(row, "status"),
    createdAt: text(row, "created_at"), ownerUserId: nullableText(row, "owner_user_id"),
    ownerEmail: nullableText(row, "owner_email"), memberCount: numberValue(row, "member_count"),
  };
}
function mapDomain(row: Row): MasterWhiteLabelDetail["domains"][number] {
  return {
    id: text(row, "id"), hostname: text(row, "hostname"), type: text(row, "type") as DomainType,
    status: text(row, "status") as DomainStatus, storeId: nullableText(row, "store_id"),
    verifiedAt: nullableText(row, "verified_at"), createdAt: text(row, "created_at"),
  };
}
function mapAudit(row: Row): MasterWhiteLabelDetail["audits"][number] {
  return {
    id: text(row, "id"), action: text(row, "action"), resourceType: text(row, "resource_type"),
    resourceId: nullableText(row, "resource_id"), actorUserId: nullableText(row, "actor_user_id"),
    createdAt: text(row, "created_at"),
  };
}
function mapCommercialPlan(row: Row): MasterWhiteLabelDetail["commercialPlans"][number] {
  return { id: text(row, "id"), slug: text(row, "slug"), name: text(row, "name"), templateName: text(row, "template_name"), active: boolValue(row, "active") };
}
function mapTemplate(row: Row): MasterWhiteLabelDetail["planTemplates"][number] {
  return { id: text(row, "id"), code: text(row, "code"), name: text(row, "name"), active: boolValue(row, "active"), entitlementCount: numberValue(row, "entitlement_count") };
}

const LIST_SQL = `select t.id::text,t.name,t.slug,t.status,t.created_at::text,
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
order by t.created_at desc,t.id desc limit $3 offset $4`;
