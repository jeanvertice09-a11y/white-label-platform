import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderPaymentId,
} from "../../packages/payments/src/types.ts";
import type { TenantProviderLoader } from "../../apps/web/src/lib/server/tenant-billing.provider.server.ts";
import { createTenantMerchantCharge } from "../../apps/web/src/lib/server/tenant-billing.charge.server.ts";
import { assignControlMerchantPlan } from "../../apps/web/src/lib/server/control-merchants.billing.server.ts";
import { loadStoreEntitlementSnapshot } from "../../packages/billing/src/postgres-entitlements.ts";
import { hasFeature, getLimit } from "../../packages/billing/src/entitlements.ts";
import { setupDatabase, type Harness } from "./harness.ts";

let h: Harness;
let fixture = 0;
const actor = "10000000-0000-4000-8000-000000000001";

interface Fixture {
  tenantId: string;
  storeId: string;
  ownerId: string;
  planId: string;
}

interface ProviderState {
  calls: number;
  inputs: CreatePaymentIntentInput[];
  failures: number;
  delayMs: number;
}

function providerLoader(options?: { failures?: number; delayMs?: number }): {
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
  return {
    state,
    loader: { load: () => Promise.resolve(provider) },
  };
}

async function createFixture(options?: { trialDays?: number; priceCents?: number }): Promise<Fixture> {
  fixture += 1;
  const suffix = String(fixture);
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
    [tenantId, actor],
  );
  await h.db.query(
    `insert into public.store_members(tenant_id,store_id,user_id,role)
     values ($1::uuid,$2::uuid,$3::uuid,'store_owner')`,
    [tenantId, storeId, ownerId],
  );
  const template = await h.db.query(
    `select id::text from public.plan_templates where active=true
     order by sort_order,id limit 1`,
  );
  const templateId = String(template.at(0)?.["id"]);
  const trialDays = options?.trialDays ?? 0;
  const plan = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,billing_interval,
       active,trial_enabled,trial_days,display_order
     ) values ($1::uuid,$2::uuid,$3,$4,$5,'monthly',true,$6,$7,0)
     returning id::text`,
    [
      tenantId,
      templateId,
      `tb-plan-${suffix}`,
      `Plano ${suffix}`,
      options?.priceCents ?? 2500,
      trialDays > 0,
      trialDays,
    ],
  );
  return { tenantId, storeId, ownerId, planId: String(plan.at(0)?.["id"]) };
}

async function addGateway(
  tenantId: string,
  provider: "mercadopago" | "asaas" = "mercadopago",
): Promise<string> {
  const rows = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ('tenant_billing',$1::uuid,null,$2,$3,'active') returning id::text`,
    [tenantId, provider, `tenant-billing-${String(fixture)}-${provider}`],
  );
  return String(rows.at(0)?.["id"]);
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript("create table if not exists auth.users(id uuid primary key,email text);");
});

afterAll(async () => { await h.db.close(); });

describe("phase 16 tenant_billing core", () => {
  test("trial real do plano é aplicado e trial válido não cobra", async () => {
    const f = await createFixture({ trialDays: 5 });
    await addGateway(f.tenantId);
    const subscription = await assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, f.planId, true);
    expect(subscription.status).toBe("trialing");
    const rows = await h.db.query(
      `select trial_started_at,trial_ends_at from public.store_subscriptions where id=$1::uuid`,
      [subscription.subscriptionId],
    );
    expect(rows.at(0)?.["trial_started_at"]).not.toBeNull();
    expect(rows.at(0)?.["trial_ends_at"]).not.toBeNull();
    const p = providerLoader();
    expect(createTenantMerchantCharge(
      h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, p.loader,
    )).rejects.toThrow("Trial válido");
    expect(p.state.calls).toBe(0);
  });

  test("preço, tenant, store, gateway e provider são exclusivamente server-side", async () => {
    const f = await createFixture({ priceCents: 3790 });
    const gatewayId = await addGateway(f.tenantId);
    const subscription = await assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, f.planId, false);
    const p = providerLoader();
    const result = await createTenantMerchantCharge(
      h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, p.loader,
    );
    expect(result.created).toBe(true);
    expect(p.state.calls).toBe(1);
    expect(p.state.inputs[0]).toMatchObject({
      level: "tenant_billing",
      tenantId: f.tenantId,
      storeId: f.storeId,
      gatewayAccountId: gatewayId,
      amountCents: 3790,
      paymentMethod: "pix",
    });
    const rows = await h.db.query(
      `select level,tenant_id::text,store_id::text,gateway_account_id::text,
         amount_cents,store_subscription_id::text
       from public.payments where id=$1::uuid`,
      [result.paymentId],
    );
    expect(rows.at(0)).toMatchObject({
      level: "tenant_billing",
      tenant_id: f.tenantId,
      store_id: f.storeId,
      gateway_account_id: gatewayId,
      amount_cents: 3790,
      store_subscription_id: subscription.subscriptionId,
    });
  });

  test("retry e concorrência reutilizam payment e fazem uma chamada provider", async () => {
    const f = await createFixture();
    await addGateway(f.tenantId);
    const subscription = await assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, f.planId, false);
    const retryProvider = providerLoader({ failures: 1 });
    expect(createTenantMerchantCharge(
      h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, retryProvider.loader,
    )).rejects.toThrow("transient");
    const retry = await createTenantMerchantCharge(
      h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, retryProvider.loader,
    );
    expect(retryProvider.state.calls).toBe(2);
    const concurrentProvider = providerLoader({ delayMs: 20 });
    const nextAnchor = "2026-10-18T00:00:00Z";
    await h.db.query(
      `update public.store_subscriptions set current_period_ends_at=$2::timestamptz
       where id=$1::uuid`,
      [subscription.subscriptionId, nextAnchor],
    );
    const now = new Date("2026-10-19T00:00:00Z");
    const both = await Promise.all([
      createTenantMerchantCharge(h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, concurrentProvider.loader, now),
      createTenantMerchantCharge(h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, concurrentProvider.loader, now),
    ]);
    expect(new Set(both.map((item) => item.paymentId)).size).toBe(1);
    expect(concurrentProvider.state.calls).toBe(1);
    const count = await h.db.query(
      `select count(*)::int total from public.payments
       where level='tenant_billing' and store_subscription_id=$1::uuid`,
      [subscription.subscriptionId],
    );
    expect(count.at(0)?.["total"]).toBe(2);
    expect(retry.paymentId).not.toBe(both[0]?.paymentId);
  });

  test("gateway ausente e Asaas sem customer mapping falham fechados", async () => {
    const missing = await createFixture();
    const subMissing = await assignControlMerchantPlan(h.db, missing.tenantId, actor, missing.storeId, missing.planId, false);
    const p = providerLoader();
    expect(createTenantMerchantCharge(
      h.db, actor, missing.tenantId, missing.storeId, subMissing.subscriptionId, p.loader,
    )).rejects.toThrow("gateway tenant_billing");
    const asaas = await createFixture();
    await addGateway(asaas.tenantId, "asaas");
    const subAsaas = await assignControlMerchantPlan(h.db, asaas.tenantId, actor, asaas.storeId, asaas.planId, false);
    expect(createTenantMerchantCharge(
      h.db, actor, asaas.tenantId, asaas.storeId, subAsaas.subscriptionId, p.loader,
    )).rejects.toThrow("customer mapping");
    expect(p.state.calls).toBe(0);
  });

  test("cross-tenant e IDOR não cobram assinatura de outro tenant/store", async () => {
    const a = await createFixture();
    const b = await createFixture();
    await addGateway(a.tenantId);
    await addGateway(b.tenantId);
    const subA = await assignControlMerchantPlan(h.db, a.tenantId, actor, a.storeId, a.planId, false);
    const p = providerLoader();
    expect(createTenantMerchantCharge(
      h.db, actor, b.tenantId, b.storeId, subA.subscriptionId, p.loader,
    )).rejects.toThrow("Assinatura tenant_billing inválida");
    expect(h.db.query(
      `insert into public.payments(
         level,tenant_id,store_id,gateway_account_id,amount_cents,store_subscription_id,idempotency_key
       ) select 'tenant_billing',$1::uuid,$2::uuid,ga.id,100,$3::uuid,'idor'
         from public.gateway_accounts ga
         where ga.level='tenant_billing' and ga.tenant_id=$1::uuid limit 1`,
      [b.tenantId, b.storeId, subA.subscriptionId],
    )).rejects.toThrow();
  });

  test("troca de plano concorrente mantém uma assinatura atual e preserva ciclo", async () => {
    const f = await createFixture();
    const first = await assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, f.planId, false);
    await h.db.query(
      `update public.store_subscriptions
       set current_period_started_at='2026-09-01T00:00:00Z',current_period_ends_at='2026-10-01T00:00:00Z'
       where id=$1::uuid`,
      [first.subscriptionId],
    );
    const template = await h.db.query(
      `select id::text from public.plan_templates where active=true and id<>(select template_id from public.tenant_plans where id=$1::uuid)
       order by sort_order,id limit 1`,
      [f.planId],
    );
    const secondPlan = await h.db.query(
      `insert into public.tenant_plans(
         tenant_id,template_id,slug,name,price_cents,billing_interval,active,trial_enabled,trial_days
       ) values ($1::uuid,$2::uuid,$3,'Upgrade',4900,'monthly',true,false,0) returning id::text`,
      [f.tenantId, String(template.at(0)?.["id"]), `upgrade-${String(fixture)}`],
    );
    const secondPlanId = String(secondPlan.at(0)?.["id"]);
    const results = await Promise.all([
      assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, secondPlanId, false),
      assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, secondPlanId, false),
    ]);
    expect(new Set(results.map((item) => item.subscriptionId)).size).toBe(1);
    const rows = await h.db.query(
      `select count(*) filter (where status in ('trialing','active','past_due','suspended'))::int current_count,
         max(current_period_ends_at)::text period_end
       from public.store_subscriptions where tenant_id=$1::uuid and store_id=$2::uuid`,
      [f.tenantId, f.storeId],
    );
    expect(rows.at(0)?.["current_count"]).toBe(1);
    expect(String(rows.at(0)?.["period_end"])).toContain("2026-10-01");
  });

  test("entitlements e limits continuam centrais e trial expirado perde acesso", async () => {
    const f = await createFixture({ trialDays: 2 });
    const templateIdRows = await h.db.query(
      "select template_id::text from public.tenant_plans where id=$1::uuid",
      [f.planId],
    );
    const templateId = String(templateIdRows.at(0)?.["template_id"]);
    await h.db.query(
      `insert into public.plan_template_entitlements(template_id,entitlement_key,enabled)
       values ($1::uuid,'products',true)
       on conflict (template_id,entitlement_key) do update set enabled=true,limit_value=null`,
      [templateId],
    );
    await h.db.query(
      `insert into public.plan_template_entitlements(template_id,entitlement_key,limit_value)
       values ($1::uuid,'max_products',100)
       on conflict (template_id,entitlement_key) do update set enabled=null,limit_value=100`,
      [templateId],
    );
    await h.db.query(
      `insert into public.tenant_plan_entitlements(tenant_id,tenant_plan_id,entitlement_key,enabled)
       values ($1::uuid,$2::uuid,'products',true)`,
      [f.tenantId, f.planId],
    );
    await h.db.query(
      `insert into public.tenant_plan_entitlements(tenant_id,tenant_plan_id,entitlement_key,limit_value)
       values ($1::uuid,$2::uuid,'max_products',20)`,
      [f.tenantId, f.planId],
    );
    const subscription = await assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, f.planId, true);
    const valid = await loadStoreEntitlementSnapshot(h.db, { tenantId: f.tenantId, storeId: f.storeId });
    expect(hasFeature(valid, "products")).toBe(true);
    expect(getLimit(valid, "max_products")).toBe(20);
    await h.db.query(
      `update public.store_subscriptions set trial_ends_at=now()-interval '1 day'
       where id=$1::uuid`,
      [subscription.subscriptionId],
    );
    const expired = await loadStoreEntitlementSnapshot(h.db, { tenantId: f.tenantId, storeId: f.storeId });
    expect(hasFeature(expired, "products")).toBe(false);
    expect(getLimit(expired, "max_products")).toBeNull();
  });

  test("auditoria não contém provider id, secret ou credencial", async () => {
    const f = await createFixture();
    await addGateway(f.tenantId);
    const subscription = await assignControlMerchantPlan(h.db, f.tenantId, actor, f.storeId, f.planId, false);
    const p = providerLoader();
    await createTenantMerchantCharge(h.db, actor, f.tenantId, f.storeId, subscription.subscriptionId, p.loader);
    const rows = await h.db.query(
      "select action,metadata from public.audit_logs where tenant_id=$1::uuid order by created_at,id",
      [f.tenantId],
    );
    const serialized = JSON.stringify(rows);
    expect(serialized).toContain("subscription.created");
    expect(serialized).toContain("tenant_billing.charge_created");
    expect(serialized).not.toContain("tb-provider-");
    expect(serialized.toLowerCase()).not.toContain("secret");
    expect(serialized.toLowerCase()).not.toContain("credential");
  });
});
