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

interface SubscriptionSummary {
  status: string;
  planName: string | null;
  planPriceCents: number | null;
  billingInterval: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
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

function planMap(rows: Row[]): Map<string, Row> {
  return new Map(rows.map((row) => [stringValue(row, "id"), row]));
}

function latestSubscriptions(
  rows: Row[],
  plans: Map<string, Row>,
): Map<string, SubscriptionSummary> {
  const out = new Map<string, SubscriptionSummary>();
  for (const row of rows) {
    const tenantId = stringValue(row, "tenant_id");
    if (out.has(tenantId)) continue;
    const planId = nullableString(row, "plan_id");
    const plan = planId ? plans.get(planId) : undefined;
    out.set(tenantId, {
      status: stringValue(row, "status"),
      planName: plan ? stringValue(plan, "name") : null,
      planPriceCents: plan ? numberValue(plan, "price_cents") : null,
      billingInterval: plan ? nullableString(plan, "billing_interval") : null,
      trialEndsAt: nullableString(row, "trial_ends_at"),
      currentPeriodEndsAt: nullableString(row, "current_period_ends_at"),
    });
  }
  return out;
}

function buildMetrics(rows: MasterRows): MasterConsoleData["metrics"] {
  const paidCents = rows.payments
    .filter((row) => stringValue(row, "status") === "captured")
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
  const subscriptions = latestSubscriptions(rows.subscriptions, planMap(rows.plans));
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
      trialEndsAt: nullableString(row, "trial_ends_at"),
      storeCount: count.total,
      activeStoreCount: count.active,
      subscriptionStatus: subscription?.status ?? null,
      planName: subscription?.planName ?? null,
      planPriceCents: subscription?.planPriceCents ?? null,
      billingInterval: subscription?.billingInterval ?? null,
      subscriptionTrialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEndsAt: subscription?.currentPeriodEndsAt ?? null,
    };
  });
}

function mapPayments(rows: MasterRows): MasterConsoleData["payments"] {
  const tenantNames = new Map(
    rows.tenants.map((row) => [stringValue(row, "id"), stringValue(row, "name")]),
  );
  const providers = new Map(
    rows.gateways.map((row) => [stringValue(row, "id"), stringValue(row, "provider")]),
  );
  return rows.payments.slice(0, 50).map((row) => {
    const tenantId = nullableString(row, "tenant_id");
    const gatewayId = nullableString(row, "gateway_account_id");
    return {
      id: stringValue(row, "id"),
      tenantName: tenantId ? (tenantNames.get(tenantId) ?? null) : null,
      amountCents: numberValue(row, "amount_cents"),
      status: stringValue(row, "status"),
      provider: gatewayId ? (providers.get(gatewayId) ?? null) : null,
      createdAt: stringValue(row, "created_at"),
    };
  });
}

function mapAudits(rows: Row[]): MasterConsoleData["audits"] {
  return rows.map((row) => ({
    id: stringValue(row, "id"),
    action: stringValue(row, "action"),
    resourceType: stringValue(row, "resource_type"),
    resourceId: nullableString(row, "resource_id"),
    tenantId: nullableString(row, "tenant_id"),
    actorUserId: nullableString(row, "actor_user_id"),
    createdAt: stringValue(row, "created_at"),
  }));
}

function mapDomains(rows: Row[]): MasterConsoleData["domains"] {
  return rows.slice(0, 100).map((row) => ({
    id: stringValue(row, "id"),
    hostname: stringValue(row, "hostname"),
    type: stringValue(row, "type"),
    status: stringValue(row, "status"),
    tenantId: stringValue(row, "tenant_id"),
    storeId: nullableString(row, "store_id"),
    verifiedAt: nullableString(row, "verified_at"),
    createdAt: stringValue(row, "created_at"),
  }));
}

function mapGateways(rows: Row[]): MasterConsoleData["gateways"] {
  return rows.slice(0, 100).map((row) => ({
    id: stringValue(row, "id"),
    provider: stringValue(row, "provider"),
    label: stringValue(row, "label"),
    level: stringValue(row, "level"),
    tenantId: nullableString(row, "tenant_id"),
    storeId: nullableString(row, "store_id"),
    createdAt: stringValue(row, "created_at"),
  }));
}

export async function loadMasterConsoleData(
  client: SupabaseClient,
): Promise<MasterConsoleData> {
  const results = await Promise.all([
    client.from("tenants")
      .select("id,name,slug,status,trial_ends_at,created_at")
      .order("created_at", { ascending: false }),
    client.from("stores").select("id,tenant_id,status"),
    client.from("subscriptions")
      .select("tenant_id,status,plan_id,trial_ends_at,current_period_ends_at,created_at")
      .eq("level", "platform_billing")
      .order("created_at", { ascending: false }),
    client.from("plans").select("id,name,price_cents,billing_interval"),
    client.from("payments")
      .select("id,tenant_id,gateway_account_id,amount_cents,status,created_at")
      .eq("level", "platform_billing")
      .order("created_at", { ascending: false })
      .limit(50),
    client.from("audit_logs")
      .select("id,action,resource_type,resource_id,tenant_id,actor_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    client.from("domains")
      .select("id,hostname,type,status,tenant_id,store_id,verified_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    client.from("gateway_accounts")
      .select("id,provider,label,level,tenant_id,store_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  assertResults(results);
  const rows: MasterRows = {
    tenants: asRows(results[0].data),
    stores: asRows(results[1].data),
    subscriptions: asRows(results[2].data),
    plans: asRows(results[3].data),
    payments: asRows(results[4].data),
    audits: asRows(results[5].data),
    domains: asRows(results[6].data),
    gateways: asRows(results[7].data),
  };
  return {
    metrics: buildMetrics(rows),
    tenants: mapTenants(rows),
    payments: mapPayments(rows),
    audits: mapAudits(rows.audits),
    domains: mapDomains(rows.domains),
    gateways: mapGateways(rows.gateways),
  };
}
