import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadControl, loadMaster } from "./route-context.server.ts";

function numberValue(row: Record<string, unknown>, key: string): number {
  return Number(row[key] ?? 0);
}

function stringValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return value === null || value === undefined ? null : String(value);
}

async function requireMaster() {
  const deps = await createRealDeps();
  await loadMaster({ host: getRequestHost() }, deps);
  return createAdminSqlExecutor();
}

async function requireControl() {
  const deps = await createRealDeps();
  const ctx = await loadControl({ host: getRequestHost() }, deps);
  return { ctx, sql: createAdminSqlExecutor() };
}

export const getMasterConsoleData = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await requireMaster();
  const [metricsRows, tenants, payments, audits, domains, gateways] = await Promise.all([
    sql.query(
      `select
        (select count(*) from public.tenants)::integer as tenants,
        (select count(*) from public.tenants where status='active')::integer as active_tenants,
        (select count(*) from public.tenants where status='trial')::integer as trial_tenants,
        (select count(*) from public.stores where status='active')::integer as active_stores,
        (select count(*) from public.subscriptions where level='platform_billing' and status='active')::integer as active_subscriptions,
        (select coalesce(sum(amount_cents),0) from public.payments where level='platform_billing' and status='paid')::bigint as paid_cents,
        (select count(*) from public.domains where status='active')::integer as active_domains`,
      [],
    ),
    sql.query(
      `select t.id,t.name,t.slug,t.status,t.created_at,
        count(distinct s.id)::integer as store_count,
        count(distinct s.id) filter (where s.status='active')::integer as active_store_count,
        latest.status as subscription_status,
        latest.plan_name
      from public.tenants t
      left join public.stores s on s.tenant_id=t.id
      left join lateral (
        select sub.status,p.name as plan_name
        from public.subscriptions sub
        left join public.plans p on p.id=sub.plan_id
        where sub.tenant_id=t.id and sub.level='platform_billing'
        order by sub.created_at desc limit 1
      ) latest on true
      group by t.id,t.name,t.slug,t.status,t.created_at,latest.status,latest.plan_name
      order by t.created_at desc`,
      [],
    ),
    sql.query(
      `select p.id,p.amount_cents,p.status,p.created_at,t.name as tenant_name
       from public.payments p
       left join public.tenants t on t.id=p.tenant_id
       where p.level='platform_billing'
       order by p.created_at desc limit 50`,
      [],
    ),
    sql.query(
      `select id,action,resource_type,resource_id,tenant_id,actor_user_id,created_at
       from public.audit_logs order by created_at desc limit 50`,
      [],
    ),
    sql.query(
      `select id,hostname,type,status,tenant_id,store_id,verified_at,created_at
       from public.domains order by created_at desc limit 100`,
      [],
    ),
    sql.query(
      `select id,provider,label,level,tenant_id,store_id,created_at
       from public.gateway_accounts order by created_at desc limit 100`,
      [],
    ),
  ]);

  const metrics = metricsRows[0] ?? {};
  return {
    metrics: {
      tenants: numberValue(metrics, "tenants"),
      activeTenants: numberValue(metrics, "active_tenants"),
      trialTenants: numberValue(metrics, "trial_tenants"),
      activeStores: numberValue(metrics, "active_stores"),
      activeSubscriptions: numberValue(metrics, "active_subscriptions"),
      paidCents: numberValue(metrics, "paid_cents"),
      activeDomains: numberValue(metrics, "active_domains"),
    },
    tenants: tenants.map((row) => ({
      id: stringValue(row, "id"),
      name: stringValue(row, "name"),
      slug: stringValue(row, "slug"),
      status: stringValue(row, "status"),
      createdAt: stringValue(row, "created_at"),
      storeCount: numberValue(row, "store_count"),
      activeStoreCount: numberValue(row, "active_store_count"),
      subscriptionStatus: nullableString(row, "subscription_status"),
      planName: nullableString(row, "plan_name"),
    })),
    payments: payments.map((row) => ({
      id: stringValue(row, "id"),
      tenantName: nullableString(row, "tenant_name"),
      amountCents: numberValue(row, "amount_cents"),
      status: stringValue(row, "status"),
      createdAt: stringValue(row, "created_at"),
    })),
    audits: audits.map((row) => ({
      id: stringValue(row, "id"),
      action: stringValue(row, "action"),
      resourceType: stringValue(row, "resource_type"),
      resourceId: nullableString(row, "resource_id"),
      tenantId: nullableString(row, "tenant_id"),
      actorUserId: nullableString(row, "actor_user_id"),
      createdAt: stringValue(row, "created_at"),
    })),
    domains: domains.map((row) => ({
      id: stringValue(row, "id"),
      hostname: stringValue(row, "hostname"),
      type: stringValue(row, "type"),
      status: stringValue(row, "status"),
      tenantId: stringValue(row, "tenant_id"),
      storeId: nullableString(row, "store_id"),
      verifiedAt: nullableString(row, "verified_at"),
      createdAt: stringValue(row, "created_at"),
    })),
    gateways: gateways.map((row) => ({
      id: stringValue(row, "id"),
      provider: stringValue(row, "provider"),
      label: stringValue(row, "label"),
      level: stringValue(row, "level"),
      tenantId: nullableString(row, "tenant_id"),
      storeId: nullableString(row, "store_id"),
      createdAt: stringValue(row, "created_at"),
    })),
  };
});

export const getTenantControlDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { ctx, sql } = await requireControl();
  const tenantId = String(ctx.tenantId);
  const [tenantRows, stores, domains, subscriptions, payments, plans, gateways] = await Promise.all([
    sql.query(
      `select t.id,t.name,t.slug,t.status,t.created_at,b.logo_url,b.primary_color,s.settings
       from public.tenants t
       left join public.tenant_branding b on b.tenant_id=t.id
       left join public.tenant_settings s on s.tenant_id=t.id
       where t.id=$1 limit 1`,
      [tenantId],
    ),
    sql.query(
      `select s.id,s.name,s.slug,s.status,s.created_at,
        count(sm.user_id)::integer as member_count
       from public.stores s
       left join public.store_members sm on sm.tenant_id=s.tenant_id and sm.store_id=s.id
       where s.tenant_id=$1
       group by s.id,s.name,s.slug,s.status,s.created_at
       order by s.created_at desc`,
      [tenantId],
    ),
    sql.query(
      `select id,hostname,type,status,store_id,verified_at,created_at
       from public.domains where tenant_id=$1 order by created_at desc`,
      [tenantId],
    ),
    sql.query(
      `select sub.id,sub.level,sub.status,sub.created_at,p.name as plan_name,p.price_cents
       from public.subscriptions sub
       left join public.plans p on p.id=sub.plan_id
       where sub.tenant_id=$1 order by sub.created_at desc`,
      [tenantId],
    ),
    sql.query(
      `select id,level,amount_cents,status,created_at
       from public.payments where tenant_id=$1 order by created_at desc limit 50`,
      [tenantId],
    ),
    sql.query(`select id,slug,name,price_cents from public.plans order by price_cents,name`, []),
    sql.query(
      `select id,provider,label,level,store_id,created_at
       from public.gateway_accounts where tenant_id=$1 order by created_at desc`,
      [tenantId],
    ),
  ]);
  const tenant = tenantRows[0];
  if (!tenant) throw new Error("White Label não encontrada");
  return {
    tenant: {
      id: stringValue(tenant, "id"),
      name: stringValue(tenant, "name"),
      slug: stringValue(tenant, "slug"),
      status: stringValue(tenant, "status"),
      createdAt: stringValue(tenant, "created_at"),
      logoUrl: nullableString(tenant, "logo_url"),
      primaryColor: nullableString(tenant, "primary_color"),
      settings: tenant["settings"] ?? {},
    },
    stores: stores.map((row) => ({
      id: stringValue(row, "id"), name: stringValue(row, "name"), slug: stringValue(row, "slug"),
      status: stringValue(row, "status"), createdAt: stringValue(row, "created_at"), memberCount: numberValue(row, "member_count"),
    })),
    domains: domains.map((row) => ({
      id: stringValue(row, "id"), hostname: stringValue(row, "hostname"), type: stringValue(row, "type"),
      status: stringValue(row, "status"), storeId: nullableString(row, "store_id"), verifiedAt: nullableString(row, "verified_at"),
    })),
    subscriptions: subscriptions.map((row) => ({
      id: stringValue(row, "id"), level: stringValue(row, "level"), status: stringValue(row, "status"),
      planName: nullableString(row, "plan_name"), priceCents: numberValue(row, "price_cents"), createdAt: stringValue(row, "created_at"),
    })),
    payments: payments.map((row) => ({
      id: stringValue(row, "id"), level: stringValue(row, "level"), amountCents: numberValue(row, "amount_cents"),
      status: stringValue(row, "status"), createdAt: stringValue(row, "created_at"),
    })),
    plans: plans.map((row) => ({
      id: stringValue(row, "id"), slug: stringValue(row, "slug"), name: stringValue(row, "name"), priceCents: numberValue(row, "price_cents"),
    })),
    gateways: gateways.map((row) => ({
      id: stringValue(row, "id"), provider: stringValue(row, "provider"), label: stringValue(row, "label"),
      level: stringValue(row, "level"), storeId: nullableString(row, "store_id"), createdAt: stringValue(row, "created_at"),
    })),
  };
});
