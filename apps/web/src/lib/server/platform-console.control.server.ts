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

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

function memberCounts(rows: Row[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const storeId = stringValue(row, "store_id");
    counts.set(storeId, (counts.get(storeId) ?? 0) + 1);
  }
  return counts;
}

function mapTenant(tenant: Row, branding: Row | undefined, settings: Row | undefined) {
  return {
    id: stringValue(tenant, "id"),
    name: stringValue(tenant, "name"),
    slug: stringValue(tenant, "slug"),
    status: stringValue(tenant, "status"),
    createdAt: stringValue(tenant, "created_at"),
    trialEndsAt: nullableString(tenant, "trial_ends_at"),
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

function mapPlans(rows: Row[]): TenantControlDashboardData["plans"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), slug: stringValue(row, "slug"), name: stringValue(row, "name"),
    priceCents: numberValue(row, "price_cents"), billingInterval: stringValue(row, "billing_interval"),
    active: booleanValue(row, "active"), trialEnabled: booleanValue(row, "trial_enabled"),
    trialDays: numberValue(row, "trial_days"),
  }));
}

function mapGateways(rows: Row[]): TenantControlDashboardData["gateways"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), provider: stringValue(row, "provider"), label: stringValue(row, "label"),
    level: stringValue(row, "level"), storeId: nullableString(row, "store_id"), createdAt: stringValue(row, "created_at"),
  }));
}

function mapMembers(rows: Row[]): TenantControlDashboardData["members"] {
  return rows.map((row) => ({
    userId: stringValue(row, "user_id"), role: stringValue(row, "role"), createdAt: stringValue(row, "created_at"),
  }));
}

function mapAudits(rows: Row[]): TenantControlDashboardData["audits"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), action: stringValue(row, "action"), resourceType: stringValue(row, "resource_type"),
    resourceId: nullableString(row, "resource_id"), actorUserId: nullableString(row, "actor_user_id"),
    createdAt: stringValue(row, "created_at"),
  }));
}

export async function loadTenantControlData(
  client: SupabaseClient,
  tenantId: string,
): Promise<TenantControlDashboardData> {
  const results = await Promise.all([
    client.from("tenants").select("id,name,slug,status,created_at,trial_ends_at").eq("id", tenantId).limit(1),
    client.from("tenant_branding").select("logo_url,primary_color").eq("tenant_id", tenantId).limit(1),
    client.from("tenant_settings").select("settings").eq("tenant_id", tenantId).limit(1),
    client.from("stores").select("id,name,slug,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("store_members").select("store_id").eq("tenant_id", tenantId),
    client.from("domains").select("id,hostname,type,status,store_id,verified_at,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("tenant_plans").select("id,slug,name,price_cents,billing_interval,active,trial_enabled,trial_days").eq("tenant_id", tenantId).order("display_order").order("created_at"),
    client.from("gateway_accounts").select("id,provider,label,level,store_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("tenant_members").select("user_id,role,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: true }),
    client.from("audit_logs").select("id,action,resource_type,resource_id,actor_user_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(25),
  ]);
  assertResults(results);
  const tenantRows = asRows(results[0].data);
  const tenant = tenantRows.at(0);
  if (!tenant) throw new Error("White Label não encontrada");
  return {
    tenant: mapTenant(tenant, asRows(results[1].data).at(0), asRows(results[2].data).at(0)),
    stores: mapStores(asRows(results[3].data), asRows(results[4].data)),
    domains: mapDomains(asRows(results[5].data)),
    plans: mapPlans(asRows(results[6].data)),
    gateways: mapGateways(asRows(results[7].data)),
    members: mapMembers(asRows(results[8].data)),
    audits: mapAudits(asRows(results[9].data)),
  };
}
