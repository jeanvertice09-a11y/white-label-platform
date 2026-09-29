import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderPaymentId,
} from "../../packages/payments/src/types.ts";
import type { TenantProviderLoader } from "../../apps/web/src/lib/server/tenant-billing.provider.server.ts";
import type { Harness } from "./harness.ts";

export const TENANT_BILLING_ACTOR = "10000000-0000-4000-8000-000000000001";
let fixtureCounter = 0;

export interface TenantBillingFixture {
  tenantId: string;
  storeId: string;
  ownerId: string;
  planId: string;
}

export interface ProviderState {
  calls: number;
  inputs: CreatePaymentIntentInput[];
  failures: number;
  delayMs: number;
}

export function createProviderLoader(options?: { failures?: number; delayMs?: number }): {
  loader: TenantProviderLoader;
  state: ProviderState;
} {
  const state: ProviderState = {
    calls: 0,
    inputs: [],
    failures: options?.failures ?? 0,
    delayMs: options?.delayMs ?? 0,
  };
  const provider: PaymentProvider = {
    name: "mercadopago",
    async createIntent(input) {
      state.calls += 1;
      state.inputs.push(input);
      if (state.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      if (state.failures > 0) {
        state.failures -= 1;
        throw new Error("fixture transient provider failure");
      }
      return { providerPaymentId: `tb-provider-${String(state.calls)}` as ProviderPaymentId };
    },
    fetchStatus() { return Promise.resolve("pending"); },
    verifyWebhook() { return Promise.resolve(true); },
    normalizeWebhook() {
      return Promise.resolve({
        externalEventId: "unused",
        type: "unused",
        providerPaymentId: null,
        status: null,
        occurredAt: null,
      });
    },
    refund() { return Promise.reject(new Error("not used")); },
  };
  return { state, loader: { load: () => Promise.resolve(provider) } };
}

export async function createTenantBillingFixture(
  h: Harness,
  options?: { trialDays?: number; priceCents?: number },
): Promise<TenantBillingFixture> {
  fixtureCounter += 1;
  const suffix = String(fixtureCounter);
  await h.db.query(
    `insert into auth.users(id,email) values ($1::uuid,'phase16-actor@example.test')
     on conflict (id) do nothing`,
    [TENANT_BILLING_ACTOR],
  );
  const owner = await h.db.query(
    "insert into auth.users(id,email) values (gen_random_uuid(),$1) returning id::text",
    [`merchant-${suffix}@example.test`],
  );
  const tenant = await h.db.query(
    `insert into public.tenants(slug,name,status)
     values ($1,$2,'active') returning id::text`,
    [`tb-tenant-${suffix}`, `Tenant ${suffix}`],
  );
  const tenantId = String(tenant.at(0)?.["id"]);
  const store = await h.db.query(
    `insert into public.stores(tenant_id,slug,name,status)
     values ($1::uuid,$2,$3,'active') returning id::text`,
    [tenantId, `tb-store-${suffix}`, `Store ${suffix}`],
  );
  const storeId = String(store.at(0)?.["id"]);
  const ownerId = String(owner.at(0)?.["id"]);
  await h.db.query(
    `insert into public.tenant_members(tenant_id,user_id,role)
     values ($1::uuid,$2::uuid,'tenant_owner')`,
    [tenantId, TENANT_BILLING_ACTOR],
  );
  await h.db.query(
    `insert into public.store_members(tenant_id,store_id,user_id,role)
     values ($1::uuid,$2::uuid,$3::uuid,'store_owner')`,
    [tenantId, storeId, ownerId],
  );
  const template = await h.db.query(
    "select id::text from public.plan_templates where active=true order by sort_order,id limit 1",
  );
  const trialDays = options?.trialDays ?? 0;
  const plan = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,billing_interval,
       active,trial_enabled,trial_days,display_order
     ) values ($1::uuid,$2::uuid,$3,$4,$5,'monthly',true,$6,$7,0)
     returning id::text`,
    [
      tenantId,
      String(template.at(0)?.["id"]),
      `tb-plan-${suffix}`,
      `Plano ${suffix}`,
      options?.priceCents ?? 2500,
      trialDays > 0,
      trialDays,
    ],
  );
  return { tenantId, storeId, ownerId, planId: String(plan.at(0)?.["id"]) };
}

export async function createTenantGateway(
  h: Harness,
  tenantId: string,
  provider: "mercadopago" | "asaas" = "mercadopago",
): Promise<string> {
  const rows = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ('tenant_billing',$1::uuid,null,$2,$3,'active') returning id::text`,
    [tenantId, provider, `tenant-billing-${String(fixtureCounter)}-${provider}`],
  );
  return String(rows.at(0)?.["id"]);
}
