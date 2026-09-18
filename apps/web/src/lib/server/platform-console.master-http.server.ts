import type { SupabaseClient } from "@supabase/supabase-js";
import type { MasterConsoleData } from "./platform-console.types.ts";
import { nullableString, numberValue, stringValue } from "./platform-console.values.ts";

interface StoreCounts {
  total: number;
  active: number;
}

interface LatestSubscription {
  status: string;
  planName: string | null;
}

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

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Row => typeof item === "object" && item !== null);
}

function assertResults(results: Array<{ error: { message: string } | null }>): void {
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Falha ao carregar console master: ${failed.error.message}`);
}

function buildStoreCounts(rows: Row[]): Map<string, StoreCounts> {
  const counts = new Map<string, StoreCounts>();
  for (const row of rows) {
    const tenantId = stringValue(row, "tenant_id");
    const current = counts.get(tenantId) ?? { total: 0, active: 0 };
    current.total += 1;
    if (stringValue(row, "status") === "active") current.active += 1;
    counts.set(tenantId, current);
  }
  return counts;
}

function buildPlanNames(rows: Row[]): Map<string, string> {
  const plans = new Map<string, string>();
  for (const row of rows) plans.set(stringValue(row, "id"), stringValue(row, "name"));
  return plans;
}

function buildLatestSubscriptions(rows: Row[], planNames: Map<string, string>): Map<string, LatestSubscription> {
  const subscriptions = new Map<string, LatestSubscription>();
  for (const row of rows) {
    const tenantId = stringValue(row, "tenant_id");
    if (subscriptions.has(tenantId)) continue;
    const planId = nullableString(row, "plan_id");
    subscriptions.set(tenantId, {
      status: stringValue(row, "status"),
      planName: planId ? (planNames.get(planId) ?? null) : null,
    });
  }
  return subscriptions;
}

function sumPaidCents(rows: Row[]): number {
  return rows.reduce((total, row) => {
    if (stringValue(row, "status") !== "paid") return total;
    return total + numberValue(row, "amount_cents");
  }, 0);
}

function buildMetrics(rows: MasterRows): MasterConsoleData["metrics"] {
  return {
    tenants: rows.tenants.length,
    activeTenants: rows.tenants.filter((row) => stringValue(row, "status") === "active").length,
    trialTenants: rows.tenants.filter((row) => stringValue(row, "status") === "trial").length,
    activeStores: rows.stores.filter((row) => stringValue(row, "status") === "active").length,
    activeSubscriptions: rows.subscriptions.filter((row) => stringValue(row, "status") === "active").length,
    paidCents: sumPaidCents(rows.payments),
    activeDomains: rows.domains.filter((row) => stringValue(row, "status") === "active").length,
  };
}

function mapTenants(rows: MasterRows): MasterConsoleData["tenants"] {
  const storeCounts = buildStoreCounts(rows.stores);
  const subscriptions = buildLatestSubscriptions(rows.subscriptions, buildPlanNames(rows.plans));
  return rows.tenants.map((row) => {
    const id = stringValue(row, "id");
    const counts = storeCounts.get(id) ?? { total: 0, active: 0 };
    const subscription = subscriptions.get(id);
    return {
      id,
      name: stringValue(row, "name"),
      slug: stringValue(row, "slug"),
      status: stringValue(row, "status"),
      createdAt: stringValue(row, "created_at"),
      storeCount: counts.total,
      activeStoreCount: counts.active,
      subscriptionStatus: subscription?.status ?? null,
      planName: subscription?.planName ?? null,
    };
  });
}

function mapPayments(rows: Row[]): MasterConsoleData["payments"] {
  return rows.slice(0, 50).map((row) => ({
    id: stringValue(row, "id"),
    tenantName: nullableString(row, "tenant_name"),
    amountCents: numberValue(row, "amount_cents"),
    status: stringValue(row, "status"),
    createdAt: stringValue(row, "created_at"),
  }));
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

function mapMasterData(rows: MasterRows): MasterConsoleData {
  return {
    metrics: buildMetrics(rows),
    tenants: mapTenants(rows),
    payments: mapPayments(rows.payments),
    audits: mapAudits(rows.audits),
    domains: mapDomains(rows.domains),
    gateways: mapGateways(rows.gateways),
  };
}

function attachTenantNames(rows: Row[]): Row[] {
  return rows.map((row) => {
    const tenant = row["tenants"];
    const tenantName = typeof tenant === "object" && tenant !== null && "name" in tenant
      ? (tenant as { name?: unknown }).name
      : null;
    return { ...row, tenant_name: tenantName };
  });
}

export async function loadMasterConsoleDataHttp(client: SupabaseClient): Promise<MasterConsoleData> {
  const [tenants, stores, subscriptions, plans, payments, audits, domains, gateways] = await Promise.all([
    client.from("tenants").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
    client.from("stores").select("id,tenant_id,status"),
    client.from("subscriptions").select("tenant_id,status,plan_id,created_at").eq("level", "platform_billing").order("created_at", { ascending: false }),
    client.from("plans").select("id,name"),
    client.from("payments").select("id,tenant_id,amount_cents,status,created_at,tenants(name)").eq("level", "platform_billing").order("created_at", { ascending: false }),
    client.from("audit_logs").select("id,action,resource_type,resource_id,tenant_id,actor_user_id,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("domains").select("id,hostname,type,status,tenant_id,store_id,verified_at,created_at").order("created_at", { ascending: false }),
    client.from("gateway_accounts").select("id,provider,label,level,tenant_id,store_id,created_at").order("created_at", { ascending: false }),
  ]);
  assertResults([tenants, stores, subscriptions, plans, payments, audits, domains, gateways]);
  return mapMasterData({
    tenants: asRows(tenants.data), stores: asRows(stores.data), subscriptions: asRows(subscriptions.data),
    plans: asRows(plans.data), payments: attachTenantNames(asRows(payments.data)), audits: asRows(audits.data),
    domains: asRows(domains.data), gateways: asRows(gateways.data),
  });
}
