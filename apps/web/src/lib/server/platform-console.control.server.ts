import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantControlDashboardData } from "./platform-console.types.ts";

interface TenantRow { id: string; name: string; slug: string; status: string; created_at: string }
interface BrandingRow { logo_url: string | null; primary_color: string | null }
interface SettingsRow { settings: unknown }
interface StoreRow { id: string; name: string; slug: string; status: string; created_at: string }
interface StoreMemberRow { store_id: string }
interface DomainRow { id: string; hostname: string; type: string; status: string; store_id: string | null; verified_at: string | null }
interface PlanRow { id: string; slug: string; name: string; price_cents: number }
interface SubscriptionRow { id: string; level: string; status: string; plan_id: string | null; created_at: string }
interface PaymentRow { id: string; level: string; amount_cents: number; status: string; created_at: string }
interface GatewayRow { id: string; provider: string; label: string; level: string; store_id: string | null; created_at: string }
interface QueryResult<T> { data: T | null; error: { message: string } | null }

function dataOrThrow<T>(result: QueryResult<T>, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: resposta vazia`);
  return result.data;
}

async function queryControl(client: SupabaseClient, tenantId: string) {
  return Promise.all([
    client.from("tenants").select("id,name,slug,status,created_at").eq("id", tenantId).limit(1),
    client.from("tenant_branding").select("logo_url,primary_color").eq("tenant_id", tenantId).limit(1),
    client.from("tenant_settings").select("settings").eq("tenant_id", tenantId).limit(1),
    client.from("stores").select("id,name,slug,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("store_members").select("store_id").eq("tenant_id", tenantId),
    client.from("domains").select("id,hostname,type,status,store_id,verified_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("subscriptions").select("id,level,status,plan_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    client.from("payments").select("id,level,amount_cents,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
    client.from("plans").select("id,slug,name,price_cents").order("price_cents").order("name"),
    client.from("gateway_accounts").select("id,provider,label,level,store_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
  ]);
}

function settingsJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function countMembers(members: StoreMemberRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const member of members) counts.set(member.store_id, (counts.get(member.store_id) ?? 0) + 1);
  return counts;
}

export async function loadTenantControlData(
  client: SupabaseClient,
  tenantId: string,
): Promise<TenantControlDashboardData> {
  const results = await queryControl(client, tenantId);
  const tenants = dataOrThrow(results[0] as QueryResult<TenantRow[]>, "White Label");
  const branding = dataOrThrow(results[1] as QueryResult<BrandingRow[]>, "Branding");
  const settings = dataOrThrow(results[2] as QueryResult<SettingsRow[]>, "Configurações");
  const stores = dataOrThrow(results[3] as QueryResult<StoreRow[]>, "Lojas");
  const members = dataOrThrow(results[4] as QueryResult<StoreMemberRow[]>, "Membros");
  const domains = dataOrThrow(results[5] as QueryResult<DomainRow[]>, "Domínios");
  const subscriptions = dataOrThrow(results[6] as QueryResult<SubscriptionRow[]>, "Assinaturas");
  const payments = dataOrThrow(results[7] as QueryResult<PaymentRow[]>, "Pagamentos");
  const plans = dataOrThrow(results[8] as QueryResult<PlanRow[]>, "Planos");
  const gateways = dataOrThrow(results[9] as QueryResult<GatewayRow[]>, "Gateways");
  const tenant = tenants[0];
  if (!tenant) throw new Error("White Label não encontrada");
  const brand = branding[0];
  const config = settings[0];
  const memberCounts = countMembers(members);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  return {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, createdAt: tenant.created_at, logoUrl: brand?.logo_url ?? null, primaryColor: brand?.primary_color ?? null, settings: settingsJson(config?.settings) },
    stores: stores.map((store) => ({ id: store.id, name: store.name, slug: store.slug, status: store.status, createdAt: store.created_at, memberCount: memberCounts.get(store.id) ?? 0 })),
    domains: domains.map((domain) => ({ id: domain.id, hostname: domain.hostname, type: domain.type, status: domain.status, storeId: domain.store_id, verifiedAt: domain.verified_at })),
    subscriptions: subscriptions.map((item) => { const plan = item.plan_id ? planById.get(item.plan_id) : undefined; return { id: item.id, level: item.level, status: item.status, planName: plan?.name ?? null, priceCents: plan?.price_cents ?? 0, createdAt: item.created_at }; }),
    payments: payments.map((item) => ({ id: item.id, level: item.level, amountCents: item.amount_cents, status: item.status, createdAt: item.created_at })),
    plans: plans.map((plan) => ({ id: plan.id, slug: plan.slug, name: plan.name, priceCents: plan.price_cents })),
    gateways: gateways.map((item) => ({ id: item.id, provider: item.provider, label: item.label, level: item.level, storeId: item.store_id, createdAt: item.created_at })),
  };
}
