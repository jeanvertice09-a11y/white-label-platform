import type { SupabaseClient } from "@supabase/supabase-js";
import type { MasterConsoleData } from "./platform-console.types.ts";

interface TenantRow { id: string; name: string; slug: string; status: string; created_at: string }
interface StoreRow { id: string; tenant_id: string; status: string }
interface PlanRow { id: string; name: string }
interface SubscriptionRow {
  id: string; tenant_id: string; status: string; plan_id: string | null;
  created_at: string; level: string;
}
interface PaymentRow {
  id: string; tenant_id: string | null; amount_cents: number; status: string;
  created_at: string; level: string;
}
interface AuditRow {
  id: string; action: string; resource_type: string; resource_id: string | null;
  tenant_id: string | null; actor_user_id: string | null; created_at: string;
}
interface DomainRow {
  id: string; hostname: string; type: string; status: string; tenant_id: string;
  store_id: string | null; verified_at: string | null; created_at: string;
}
interface GatewayRow {
  id: string; provider: string; label: string; level: string;
  tenant_id: string | null; store_id: string | null; created_at: string;
}
interface QueryResult<T> { data: T | null; error: { message: string } | null }

function dataOrThrow<T>(result: QueryResult<T>, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: resposta vazia`);
  return result.data;
}

async function queryMaster(client: SupabaseClient) {
  return Promise.all([
    client.from("tenants").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
    client.from("stores").select("id,tenant_id,status"),
    client.from("plans").select("id,name"),
    client.from("subscriptions").select("id,tenant_id,status,plan_id,created_at,level").eq("level", "platform_billing").order("created_at", { ascending: false }),
    client.from("payments").select("id,tenant_id,amount_cents,status,created_at,level").eq("level", "platform_billing").order("created_at", { ascending: false }),
    client.from("audit_logs").select("id,action,resource_type,resource_id,tenant_id,actor_user_id,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("domains").select("id,hostname,type,status,tenant_id,store_id,verified_at,created_at").order("created_at", { ascending: false }),
    client.from("gateway_accounts").select("id,provider,label,level,tenant_id,store_id,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
}

function tenantCards(
  tenants: TenantRow[], stores: StoreRow[], subscriptions: SubscriptionRow[], plans: PlanRow[],
): MasterConsoleData["tenants"] {
  const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));
  const latest = new Map<string, SubscriptionRow>();
  for (const subscription of subscriptions) {
    if (!latest.has(subscription.tenant_id)) latest.set(subscription.tenant_id, subscription);
  }
  return tenants.map((tenant) => {
    const scopedStores = stores.filter((store) => store.tenant_id === tenant.id);
    const subscription = latest.get(tenant.id);
    return {
      id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status,
      createdAt: tenant.created_at, storeCount: scopedStores.length,
      activeStoreCount: scopedStores.filter((store) => store.status === "active").length,
      subscriptionStatus: subscription?.status ?? null,
      planName: subscription?.plan_id ? (planNames.get(subscription.plan_id) ?? null) : null,
    };
  });
}

function masterMetrics(
  tenants: TenantRow[], stores: StoreRow[], subscriptions: SubscriptionRow[],
  payments: PaymentRow[], domains: DomainRow[],
): MasterConsoleData["metrics"] {
  return {
    tenants: tenants.length,
    activeTenants: tenants.filter((tenant) => tenant.status === "active").length,
    trialTenants: tenants.filter((tenant) => tenant.status === "trial").length,
    activeStores: stores.filter((store) => store.status === "active").length,
    activeSubscriptions: subscriptions.filter((item) => item.status === "active").length,
    paidCents: payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount_cents, 0),
    activeDomains: domains.filter((domain) => domain.status === "active").length,
  };
}

export async function loadMasterConsoleData(client: SupabaseClient): Promise<MasterConsoleData> {
  const results = await queryMaster(client);
  const tenants = dataOrThrow(results[0] as QueryResult<TenantRow[]>, "Tenants");
  const stores = dataOrThrow(results[1] as QueryResult<StoreRow[]>, "Stores");
  const plans = dataOrThrow(results[2] as QueryResult<PlanRow[]>, "Plans");
  const subscriptions = dataOrThrow(results[3] as QueryResult<SubscriptionRow[]>, "Subscriptions");
  const payments = dataOrThrow(results[4] as QueryResult<PaymentRow[]>, "Payments");
  const audits = dataOrThrow(results[5] as QueryResult<AuditRow[]>, "Auditoria");
  const domains = dataOrThrow(results[6] as QueryResult<DomainRow[]>, "Domínios");
  const gateways = dataOrThrow(results[7] as QueryResult<GatewayRow[]>, "Gateways");
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  return {
    metrics: masterMetrics(tenants, stores, subscriptions, payments, domains),
    tenants: tenantCards(tenants, stores, subscriptions, plans),
    payments: payments.slice(0, 50).map((item) => ({ id: item.id, tenantName: item.tenant_id ? (tenantNames.get(item.tenant_id) ?? null) : null, amountCents: item.amount_cents, status: item.status, createdAt: item.created_at })),
    audits: audits.map((item) => ({ id: item.id, action: item.action, resourceType: item.resource_type, resourceId: item.resource_id, tenantId: item.tenant_id, actorUserId: item.actor_user_id, createdAt: item.created_at })),
    domains: domains.slice(0, 100).map((item) => ({ id: item.id, hostname: item.hostname, type: item.type, status: item.status, tenantId: item.tenant_id, storeId: item.store_id, verifiedAt: item.verified_at, createdAt: item.created_at })),
    gateways: gateways.map((item) => ({ id: item.id, provider: item.provider, label: item.label, level: item.level, tenantId: item.tenant_id, storeId: item.store_id, createdAt: item.created_at })),
  };
}
