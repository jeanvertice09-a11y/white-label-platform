import type {
  ControlMerchantDetail,
  ControlMerchantEntitlement,
  ControlMerchantListItem,
  ControlMerchantListResult,
  ControlMerchantPlanOption,
  ControlMerchantWorkspace,
  ControlStoreStatus,
  ControlSubscriptionStatus,
} from "./control-merchants.types.ts";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import { nullableText, numberValue, text } from "./control-merchants.shared.server.ts";

export interface ControlMerchantListInput {
  query: string;
  status: "all" | ControlStoreStatus;
  page: number;
  pageSize: number;
}

const STORE_SELECT = `select s.id::text,s.name,s.slug,s.status,s.created_at::text,
  owner.user_id::text owner_user_id,owner.email::text owner_email,
  (select count(*) from public.store_members sm
    where sm.tenant_id=s.tenant_id and sm.store_id=s.id)::integer member_count,
  (select count(*) from public.domains d
    where d.tenant_id=s.tenant_id and d.store_id=s.id)::integer domain_count,
  sub.id::text subscription_id,sub.status subscription_status,
  sub.trial_started_at::text,sub.trial_ends_at::text,
  p.id::text plan_id,p.name plan_name
from public.stores s
left join lateral (
  select sm.user_id,u.email from public.store_members sm
  left join auth.users u on u.id=sm.user_id
  where sm.tenant_id=s.tenant_id and sm.store_id=s.id and sm.role='store_owner'
  order by sm.created_at,sm.user_id limit 1
) owner on true
left join lateral (
  select ss.id,ss.status,ss.tenant_plan_id,ss.trial_started_at,ss.trial_ends_at
  from public.store_subscriptions ss
  where ss.tenant_id=s.tenant_id and ss.store_id=s.id
  order by (ss.status in ('trialing','active','past_due','suspended')) desc,ss.created_at desc
  limit 1
) sub on true
left join public.tenant_plans p on p.tenant_id=s.tenant_id and p.id=sub.tenant_plan_id`;

function mapMerchant(row: Record<string, unknown>): ControlMerchantListItem {
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    slug: text(row, "slug"),
    status: text(row, "status") as ControlStoreStatus,
    createdAt: text(row, "created_at"),
    ownerUserId: nullableText(row, "owner_user_id"),
    ownerEmail: nullableText(row, "owner_email"),
    memberCount: numberValue(row, "member_count"),
    domainCount: numberValue(row, "domain_count"),
    subscriptionId: nullableText(row, "subscription_id"),
    subscriptionStatus: nullableText(row, "subscription_status") as ControlSubscriptionStatus | null,
    planId: nullableText(row, "plan_id"),
    planName: nullableText(row, "plan_name"),
    trialStartedAt: nullableText(row, "trial_started_at"),
    trialEndsAt: nullableText(row, "trial_ends_at"),
  };
}

async function merchantRows(
  sql: ControlSql,
  tenantId: string,
  input: ControlMerchantListInput,
): Promise<Record<string, unknown>[]> {
  const offset = (input.page - 1) * input.pageSize;
  return sql.query(
    `${STORE_SELECT}
     where s.tenant_id=$1::uuid
       and ($2='' or s.name ilike '%'||$2||'%' or s.slug ilike '%'||$2||'%'
            or coalesce(owner.email,'') ilike '%'||$2||'%')
       and ($3='all' or s.status=$3)
     order by s.created_at desc,s.id
     limit $4 offset $5`,
    [tenantId, input.query.trim(), input.status, input.pageSize, offset],
  );
}

async function merchantCount(
  sql: ControlSql,
  tenantId: string,
  input: ControlMerchantListInput,
): Promise<number> {
  const rows = await sql.query(
    `select count(*)::integer total from public.stores s
     left join lateral (
       select u.email from public.store_members sm
       left join auth.users u on u.id=sm.user_id
       where sm.tenant_id=s.tenant_id and sm.store_id=s.id and sm.role='store_owner'
       order by sm.created_at,sm.user_id limit 1
     ) owner on true
     where s.tenant_id=$1::uuid
       and ($2='' or s.name ilike '%'||$2||'%' or s.slug ilike '%'||$2||'%'
            or coalesce(owner.email,'') ilike '%'||$2||'%')
       and ($3='all' or s.status=$3)`,
    [tenantId, input.query.trim(), input.status],
  );
  return numberValue(rows[0] ?? {}, "total");
}

export async function listControlMerchants(
  sql: ControlSql,
  tenantId: string,
  input: ControlMerchantListInput,
): Promise<ControlMerchantListResult> {
  const [rows, total] = await Promise.all([
    merchantRows(sql, tenantId, input),
    merchantCount(sql, tenantId, input),
  ]);
  return {
    items: rows.map(mapMerchant),
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

export async function listControlMerchantPlans(
  sql: ControlSql,
  tenantId: string,
): Promise<ControlMerchantPlanOption[]> {
  const rows = await sql.query(
    `select id::text,name,slug,price_cents,billing_interval,trial_enabled,trial_days
     from public.tenant_plans
     where tenant_id=$1::uuid and active=true
     order by display_order,created_at`,
    [tenantId],
  );
  return rows.map((row) => ({
    id: text(row, "id"),
    name: text(row, "name"),
    slug: text(row, "slug"),
    priceCents: numberValue(row, "price_cents"),
    billingInterval: text(row, "billing_interval"),
    trialEnabled: row["trial_enabled"] === true,
    trialDays: numberValue(row, "trial_days"),
  }));
}

export async function loadControlMerchantWorkspace(
  sql: ControlSql,
  tenantId: string,
): Promise<ControlMerchantWorkspace> {
  const input: ControlMerchantListInput = { query: "", status: "all", page: 1, pageSize: 10 };
  const [list, plans] = await Promise.all([
    listControlMerchants(sql, tenantId, input),
    listControlMerchantPlans(sql, tenantId),
  ]);
  return { list, plans };
}

function mapEntitlement(row: Record<string, unknown>): ControlMerchantEntitlement {
  return {
    key: text(row, "entitlement_key"),
    name: text(row, "name"),
    kind: text(row, "kind") as "feature" | "limit",
    enabled: row["enabled"] === null ? null : row["enabled"] === true,
    limitValue: row["limit_value"] === null ? null : numberValue(row, "limit_value"),
  };
}

async function detailCollections(sql: ControlSql, tenantId: string, storeId: string) {
  return Promise.all([
    sql.query(`${STORE_SELECT} where s.tenant_id=$1::uuid and s.id=$2::uuid`, [tenantId, storeId]),
    sql.query(
      `select sm.user_id::text,u.email::text,sm.role,sm.created_at::text
       from public.store_members sm left join auth.users u on u.id=sm.user_id
       where sm.tenant_id=$1::uuid and sm.store_id=$2::uuid
       order by sm.role,sm.created_at`,
      [tenantId, storeId],
    ),
    sql.query(
      `select id::text,hostname,type,status,verified_at::text
       from public.domains
       where tenant_id=$1::uuid and store_id=$2::uuid
       order by created_at desc`,
      [tenantId, storeId],
    ),
  ]);
}

async function detailEntitlements(
  sql: ControlSql,
  tenantId: string,
  planId: string | null,
): Promise<ControlMerchantEntitlement[]> {
  if (!planId) return [];
  const rows = await sql.query(
    `select e.entitlement_key,d.name,d.kind,e.enabled,e.limit_value
     from public.tenant_plan_entitlements e
     join public.entitlement_definitions d on d.key=e.entitlement_key and d.active=true
     where e.tenant_id=$1::uuid and e.tenant_plan_id=$2::uuid
     order by d.kind,e.entitlement_key`,
    [tenantId, planId],
  );
  return rows.map(mapEntitlement);
}

export async function getControlMerchantDetail(
  sql: ControlSql,
  tenantId: string,
  storeId: string,
): Promise<ControlMerchantDetail | null> {
  const [storeRows, members, domains] = await detailCollections(sql, tenantId, storeId);
  const row = storeRows[0];
  if (!row) return null;
  const merchant = mapMerchant(row);
  return {
    merchant,
    members: members.map((member) => ({
      userId: text(member, "user_id"),
      email: nullableText(member, "email"),
      role: text(member, "role"),
      createdAt: text(member, "created_at"),
    })),
    domains: domains.map((domain) => ({
      id: text(domain, "id"),
      hostname: text(domain, "hostname"),
      type: text(domain, "type"),
      status: text(domain, "status"),
      verifiedAt: nullableText(domain, "verified_at"),
    })),
    entitlements: await detailEntitlements(sql, tenantId, merchant.planId),
  };
}
