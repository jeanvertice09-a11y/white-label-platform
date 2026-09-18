import type { SupabaseClient } from "@supabase/supabase-js";
import type { MasterConsoleData } from "./platform-console.types.ts";
import { nullableString, numberValue, stringValue } from "./platform-console.values.ts";

type Row = Record<string, unknown>;

interface MasterRows {
  tenants: Row[];
  stores: Row[];
  subscriptions: Row[];
  plans: Row[];
  payments: Row[];
  audits: Row[];
  domains: Row[];
  gateways: Row[];
}

function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Row => typeof item === "object" && item !== null);
}

function assertResults(results: Array<{ error: { message: string } | null }>): void {
  const failed = results.find((result) => result.error !== null);
  if (failed?.error) throw new Error(`Falha ao carregar console master: ${failed.error.message}`);
}

function storeCounts(rows: Row[]): Map<string, { total: number; active: number }> {
  const out = new Map<string, { total: number; active: number }>();
  for (const row of rows) {
    const tenantId = stringValue(row, "tenant_id");
    const current = out.get(tenantId) ?? { total: 0, active: 0 };
    current.total += 1;
    if (stringValue(row, "status") === "active") current.active += 1;
    out.set(tenantId, current);
  }
  return out;
}

function planNames(rows: Row[]): Map<string, string> {
  return new Map(rows.map((row) => [stringValue(row, "id"), stringValue(row, "name")]));
}

function latestSubscriptions(rows: Row[], plans: Map<string, string>) {
  const out = new Map<string, { status: string; planName: string | null }>();
  for (const row of rows) {
    const tenantId = stringValue(row, "tenant_id");
    if (out.has(tenantId)) continue;
    const planId = nullableString(row, "plan_id");
    out.set(tenantId, {
      status: stringValue(row, "status"),
      planName: planId ? (plans.get(planId) ?? null) : null,
    });
  }
  return out;
}

function buildMetrics(rows: MasterRows): MasterConsoleData["metrics"] {
  const paidCents = rows.payments
    .filter((row) => stringValue(row, "status") === "paid")
    .reduce((sum, row) => sum + numberValue(row, "amount_cents"), 0);
  return {
    tenants: rows.tenants.length,
    activeTenants: rows.tenants.filter((row) => stringValue(row, "status") === "active").length,
    trialTenants: rows.tenants.filter((row) => stringValue(row, "status") === "trial").length,
    activeStores: rows.stores.filter((row) => stringValue(row, "status") === "active").length,
    activeSubscriptions: rows.subscriptions.filter((row) => stringValue(row, "status") === "active").length,
    paidCents,
    activeDomains: rows.domains.filter((row) => stringValue(row, "status") === "active").length,
  };
}

function mapTenants(rows: MasterRows): MasterConsoleData["tenants"] {
  const counts = storeCounts(rows.stores);
  const subscriptions = latestSubscriptions(rows.subscriptions, planNames(rows.plans));
  return rows.tenants.map((row) => {
    const id = stringValue(row, "id");
    const count = counts.get(id) ?? { total: 0, active: 0 };
    const subscription = subscriptions.get(id);
    return {
      id,
      name: stringValue(row, "name"),
      slug: stringValue(row, "slug"),
      status: stringValue(row, "status"),
      createdAt: stringValue(row, "created_at"),
      storeCount: count.total,
      activeStoreCount: count.active,
      subscriptionStatus: subscription?.status ?? null,
      planName: subscription?.planName ?? null,
    };
  });
}

function mapPayments(rows: Row[], tenants: Row[]): MasterConsoleData["payments"] {
  const names = new Map(tenants.map((row) => [stringValue(row, "id"), stringValue(row, "name")]));
  return rows.slice(0, 50).map((row) => {
    const tenantId = nullableString(row, "tenant_id");
    return {
      id: stringValue(row, "id"),
      tenantName: tenantId ? (names.get(tenantId) ?? null) : null,
      amountCents: numberValue(row, "amount_cents"),
      status: stringValue(row, "status"),
      createdAt: stringValue(row, "created_at"),
    };
  });
}

function mapAudits(rows: Row[]): MasterConsoleData["audits"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"), action: stringValue(row, "action"),
    resourceType: stringValue(row, "resource_type"), resourceId: nullableString(row, "resource_id"),
    tenantId: nullableString(row, "tenant_id"), actorUserId: nullableString(row, "actor_user_id"),
    createdAt: stringValue(row, "created_at"),
  }));
}

function mapDomains(rows: Row[]): MasterConsoleData["domains"] {
  return rows.slice(0, 100).map((row) => ({
    id: stringValue(row, "id"), hostname: stringValue(row, "hostname"), type: stringValue(row, "type"),
    status: stringValue(row, "status"), tenantId: stringValue(row, "tenant_id"),
    storeId: nullableString(row, "store_id"), verifiedAt: nullableString(row, "verified_at"),
    createdAt: stringValue(row, "created_at"),
  }));
}

function mapGateways(rows: Row[]): MasterConsoleData["gateways"] {
  return rows.slice(0, 100).map((row) => ({
    id: stringValue(row, "id"), provider: stringValue(row, "provider"), label: stringValue(row, "label"),
    level: stringValue(row, "level"), tenantId: nullableString(row, "tenant_id"),
    storeId: nullableString(row, "store_id"), createdAt: stringValue(row, "created_at"),
  }));
}

export async function loadMasterConsoleData(client: SupabaseClient): Promise<MasterConsoleData> {
  const results = await Promise.all([
    client.from("tenants").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
    client.from("stores").select("id,tenant_id,status"),
    client.from("subscriptions").select("tenant_id,status,plan_id,created_at").eq("level", "platform_billing").order("created_at", { ascending: false }),
    client.from("plans").select("id,name"),
    client.from("payments").select("id,tenant_id,amount_cents,status,created_at").eq("level", "platform_billing").order("created_at", { ascending: false }).limit(50),
    client.from("audit_logs").select("id,action,resource_type,resource_id,tenant_id,actor_user_id,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("domains").select("id,hostname,type,status,tenant_id,store_id,verified_at,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("gateway_accounts").select("id,provider,label,level,tenant_id,store_id,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  assertResults(results);
  const rows: MasterRows = {
    tenants: asRows(results[0].data), stores: asRows(results[1].data), subscriptions: asRows(results[2].data),
    plans: asRows(results[3].data), payments: asRows(results[4].data), audits: asRows(results[5].data),
    domains: asRows(results[6].data), gateways: asRows(results[7].data),
  };
  return {
    metrics: buildMetrics(rows), tenants: mapTenants(rows), payments: mapPayments(rows.payments, rows.tenants),
    audits: mapAudits(rows.audits), domains: mapDomains(rows.domains), gateways: mapGateways(rows.gateways),
  };
}
