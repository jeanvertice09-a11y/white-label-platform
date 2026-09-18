import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantControlDashboardData } from "./platform-console.types.ts";
import { nullableString, numberValue, stringValue } from "./platform-console.values.ts";

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Row => typeof item === "object" && item !== null);
}

function assertResults(results: Array<{ error: { message: string } | null }>): void {
  const failed = results.find((result) => result.error !== null);
  if (failed?.error) throw new Error(`Falha ao carregar White Label Control: ${failed.error.message}`);
}

function settingsJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function memberCounts(rows: Row[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const storeId = stringValue(row, "store_id");
    counts.set(storeId, (counts.get(storeId) ?? 0) + 1);
  }
  return counts;
}

function planMap(rows: Row[]): Map<string, { name: string; priceCents: number }> {
  const plans = new Map<string, { name: string; priceCents: number }>();
  for (const row of rows) {
    plans.set(stringValue(row, "id"), {
      name: stringValue(row, "name"),
      priceCents: numberValue(row, "price_cents"),
    });
  }
  return plans;
}

function mapTenant(tenant: Row, branding: Row | undefined, settings: Row | undefined) {
  return {
    id: stringValue(tenant, "id"),
    name: stringValue(tenant, "name"),
    slug: stringValue(tenant, "slug"),
    status: stringValue(tenant, "status"),
    createdAt: stringValue(tenant, "created_at"),
    logoUrl: branding ? nullableString(branding, "logo_url") : null,
    primaryColor: branding ? nullableString(branding, "primary_color") : null,
    settings: settingsJson(settings?.["settings"]),
  };
}

function mapStores(rows: Row[], members: Row[]): TenantControlDashboardData["stores"] {
  const counts = memberCounts(members);
  return rows.map((row) => ({
    id: stringValue(row, "id"),
    name: stringValue(row, "name"),
    slug: stringValue(row, "slug"),
    status: stringValue(row, "status"),
    createdAt: stringValue(row, "created_at"),
    memberCount: counts.get(stringValue(row, "id")) ?? 0,
  }));
}

function mapDomains(rows: Row[]): TenantControlDashboardData["domains"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), hostname: stringValue(row, "hostname"),
    type: stringValue(row, "type"), status: stringValue(row, "status"),
    storeId: nullableString(row, "store_id"), verifiedAt: nullableString(row, "verified_at"),
  }));
}

function mapSubscriptions(rows: Row[], plans: Row[]): TenantControlDashboardData["subscriptions"] {
  const byId = planMap(plans);
  return rows.map((row) => {
    const planId = nullableString(row, "plan_id");
    const plan = planId ? byId.get(planId) : undefined;
    return {
      id: stringValue(row, "id"), level: stringValue(row, "level"), status: stringValue(row, "status"),
      planName: plan?.name ?? null, priceCents: plan?.priceCents ?? 0, createdAt: stringValue(row, "created_at"),
    };
  });
}

function mapPayments(rows: Row[]): TenantControlDashboardData["payments"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), level: stringValue(row, "level"),
    amountCents: numberValue(row, "amount_cents"), status: stringValue(row, "status"),
    createdAt: stringValue(row, "created_at"),
  }));
}

function mapPlans(rows: Row[]): TenantControlDashboardData["plans"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), slug: stringValue(row, "slug"),
    name: stringValue(row, "name"), priceCents: numberValue(row, "price_cents"),
  }));
}

function mapGateways(rows: Row[]): TenantControlDashboardData["gateways"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), provider: stringValue(row, "provider"), label: stringValue(row, "label"),
    level: stringValue(row, "level"), storeId: nullableString(row, "store_id"), createdAt: stringValue(row, "created_at"),
  }));
}

export async function loadTenantControlData(
  client: SupabaseClient,
  tenantId: string,
): Promise<TenantControlDashboardData> {
  const results = await Promise.all([
    client.from("tenants").select("id,name,slug,status,created_at").eq("id", tenantId).limit(1),
    client.from("tenant_branding").select("logo_url,primary_color").eq("tenant_id", tenantId).limit(1),
    client.from("tenant_settings").select("settings").eq("tenant_id", tenantId).limit(1),
    client.from("stores").select("id,name,slug,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("store_members").select("store_id").eq("tenant_id", tenantId),
    client.from("domains").select("id,hostname,type,status,store_id,verified_at,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("subscriptions").select("id,level,status,plan_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("payments").select("id,level,amount_cents,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
    client.from("plans").select("id,slug,name,price_cents").order("price_cents").order("name"),
    client.from("gateway_accounts").select("id,provider,label,level,store_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
  ]);
  assertResults(results);
  const tenantRows = asRows(results[0].data);
  const tenant = tenantRows.at(0);
  if (!tenant) throw new Error("White Label não encontrada");
  const branding = asRows(results[1].data).at(0);
  const settings = asRows(results[2].data).at(0);
  const stores = asRows(results[3].data);
  const members = asRows(results[4].data);
  const domains = asRows(results[5].data);
  const subscriptions = asRows(results[6].data);
  const payments = asRows(results[7].data);
  const plans = asRows(results[8].data);
  const gateways = asRows(results[9].data);
  return {
    tenant: mapTenant(tenant, branding, settings), stores: mapStores(stores, members),
    domains: mapDomains(domains), subscriptions: mapSubscriptions(subscriptions, plans),
    payments: mapPayments(payments), plans: mapPlans(plans), gateways: mapGateways(gateways),
  };
}
