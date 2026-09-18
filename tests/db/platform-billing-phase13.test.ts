import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderPaymentId,
} from "../../packages/payments/src/types.ts";
import type { PlatformProviderLoader } from "../../apps/web/src/lib/server/platform-billing.provider.server.ts";
import { createPlatformCharge } from "../../apps/web/src/lib/server/platform-billing.charge.server.ts";
import { createPlatformSubscription } from "../../apps/web/src/lib/server/platform-billing.subscription.server.ts";
import { setupDatabase, type Harness } from "./harness.ts";

let h: Harness;
let planId = "";
let fixtureCounter = 0;
const actor = "10000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-18T18:00:00Z");

interface ProviderState {
  calls: number;
  loadCalls: number;
  failures: number;
  delayMs: number;
  inputs: CreatePaymentIntentInput[];
  gateways: Array<{ id: string; provider: string }>;
}

function providerFixture(options?: { failures?: number; delayMs?: number }): {
  loader: PlatformProviderLoader;
  state: ProviderState;
} {
  const state: ProviderState = {
    calls: 0, loadCalls: 0, failures: options?.failures ?? 0,
    delayMs: options?.delayMs ?? 0, inputs: [], gateways: [],
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
      return { providerPaymentId: `fixture-pay-${String(state.calls)}` as ProviderPaymentId };
    },
    fetchStatus() { return Promise.resolve("pending"); },
    verifyWebhook() { return Promise.resolve(true); },
    normalizeWebhook() {
      return Promise.resolve({
        externalEventId: "unused", type: "unused", providerPaymentId: null,
        status: null, occurredAt: null,
      });
    },
    refund() { return Promise.reject(new Error("not used")); },
  };
  return {
    state,
    loader: {
      load(gateway) {
        state.loadCalls += 1;
        state.gateways.push(gateway);
        return Promise.resolve(provider);
      },
    },
  };
}

async function makeTenant(
  status: "trial" | "active" | "suspended" = "active",
  trialEndsAt: string | null = null,
): Promise<string> {
  fixtureCounter += 1;
  const suffix = String(fixtureCounter);
  const owner = await h.db.query(
    "insert into auth.users(id,email) values (gen_random_uuid(),$1) returning id::text",
    [`platform-owner-${suffix}@example.test`],
  );
  const tenant = await h.db.query(
    `insert into public.tenants(slug,name,status,trial_ends_at)
     values ($1,$2,$3,$4::timestamptz) returning id::text`,
    [`pb-${suffix}`, `Platform Billing ${suffix}`, status, trialEndsAt],
  );
  const tenantId = String(tenant.at(0)?.["id"]);
  await h.db.query(
    "insert into public.tenant_members(tenant_id,user_id,role) values ($1::uuid,$2::uuid,'tenant_owner')",
    [tenantId, String(owner.at(0)?.["id"])],
  );
  return tenantId;
}

async function disablePlatformGateways(): Promise<void> {
  await h.db.query("update public.gateway_accounts set status='disabled' where level='platform_billing'");
}

async function addGateway(
  level: "platform_billing" | "tenant_billing" | "store_checkout",
  provider: "mercadopago" | "asaas",
  tenantId: string | null = null,
  storeId: string | null = null,
): Promise<string> {
  const rows = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ($1,$2::uuid,$3::uuid,$4,$5,'active') returning id::text`,
    [level, tenantId, storeId, provider, `${level}-${provider}-${String(fixtureCounter)}`],
  );
  return String(rows.at(0)?.["id"]);
}

async function addStore(tenantId: string): Promise<string> {
  const suffix = String(fixtureCounter);
  const rows = await h.db.query(
    `insert into public.stores(tenant_id,slug,name,status)
     values ($1::uuid,$2,$3,'active') returning id::text`,
    [tenantId, `store-${suffix}`, `Store ${suffix}`],
  );
  return String(rows.at(0)?.["id"]);
}

async function subscribe(tenantId: string, at = NOW): Promise<string> {
  return (await createPlatformSubscription(h.db, actor, tenantId, planId, at)).id;
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript("create table if not exists auth.users(id uuid primary key,email text);");
  const plan = await h.db.query(
    `insert into public.plans(slug,name,price_cents,active,billing_interval)
     values ('kataluu-fixture','Kataluu Fixture',1299,true,'monthly') returning id::text`,
  );
  planId = String(plan.at(0)?.["id"]);
});

afterAll(async () => { await h.db.close(); });

describe("fase 13 platform_billing core", () => {
  test("trial válido cria trialing; trial expirado cria past_due", async () => {
    const validTenant = await makeTenant("trial", "2026-09-20T18:00:00Z");
    const valid = await createPlatformSubscription(h.db, actor, validTenant, planId, NOW);
    expect(valid.status).toBe("trialing");
    const expiredTenant = await makeTenant("trial", "2026-09-17T18:00:00Z");
    const expired = await createPlatformSubscription(h.db, actor, expiredTenant, planId, NOW);
    expect(expired.status).toBe("past_due");
  });

  test("preço, tenant, gateway e provider são resolvidos server-side", async () => {
    await disablePlatformGateways();
    const tenantId = await makeTenant();
    const gatewayId = await addGateway("platform_billing", "mercadopago");
    const subscriptionId = await subscribe(tenantId);
    const fixture = providerFixture();
    const result = await createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW);
    expect(result.created).toBe(true);
    expect(fixture.state.calls).toBe(1);
    expect(fixture.state.gateways[0]).toEqual({ id: gatewayId, provider: "mercadopago" });
    expect(fixture.state.inputs[0]).toMatchObject({
      level: "platform_billing", tenantId, storeId: null, gatewayAccountId: gatewayId,
      amountCents: 1299, paymentMethod: "pix",
    });
    const row = await h.db.query(
      `select level,tenant_id::text,store_id,gateway_account_id::text,amount_cents,status
       from public.payments where id=$1::uuid`, [result.paymentId],
    );
    expect(row.at(0)).toMatchObject({
      level: "platform_billing", tenant_id: tenantId, store_id: null,
      gateway_account_id: gatewayId, amount_cents: 1299, status: "pending",
    });
  });

  test("trial válido bloqueia cobrança antes do provider", async () => {
    await disablePlatformGateways();
    const tenantId = await makeTenant("trial", "2026-09-20T18:00:00Z");
    await addGateway("platform_billing", "mercadopago");
    const subscriptionId = await subscribe(tenantId);
    const fixture = providerFixture();
    expect(createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW)).rejects.toThrow("Trial válido");
    expect(fixture.state.loadCalls).toBe(0);
  });

  test("idempotência e concorrência geram uma cobrança lógica e uma chamada provider", async () => {
    await disablePlatformGateways();
    const tenantId = await makeTenant();
    await addGateway("platform_billing", "mercadopago");
    const subscriptionId = await subscribe(tenantId);
    const fixture = providerFixture({ delayMs: 25 });
    const results = await Promise.all([
      createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW),
      createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW),
    ]);
    expect(new Set(results.map((result) => result.paymentId)).size).toBe(1);
    expect(fixture.state.calls).toBe(1);
    const count = await h.db.query(
      "select count(*)::int total from public.payments where subscription_id=$1::uuid", [subscriptionId],
    );
    expect(count.at(0)?.["total"]).toBe(1);
  });

  test("falha transitória libera claim e retry reutiliza o mesmo payment", async () => {
    await disablePlatformGateways();
    const tenantId = await makeTenant();
    await addGateway("platform_billing", "mercadopago");
    const subscriptionId = await subscribe(tenantId);
    const fixture = providerFixture({ failures: 1 });
    expect(createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW)).rejects.toThrow("transient");
    const retry = await createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW);
    expect(retry.created).toBe(true);
    expect(fixture.state.calls).toBe(2);
    const rows = await h.db.query(
      `select count(*)::int total,min(provider_create_started_at) claim
       from public.payments where subscription_id=$1::uuid`, [subscriptionId],
    );
    expect(rows.at(0)?.["total"]).toBe(1);
    expect(rows.at(0)?.["claim"]).toBeNull();
  });

  test("ausência de plano/gateway e mapping Asaas falham fechados", async () => {
    const tenantId = await makeTenant();
    expect(createPlatformSubscription(h.db, actor, tenantId, "ffffffff-ffff-4fff-8fff-ffffffffffff", NOW))
      .rejects.toThrow("Plano Kataluu inexistente");
    const subscriptionId = await subscribe(tenantId);
    await disablePlatformGateways();
    const fixture = providerFixture();
    expect(createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW)).rejects.toThrow("gateway platform_billing");
    await addGateway("platform_billing", "asaas");
    expect(createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW)).rejects.toThrow("customer mapping");
    expect(fixture.state.loadCalls).toBe(0);
  });

  test("tenant_billing/store_checkout não substituem gateway da plataforma e cross-tenant é rejeitado", async () => {
    await disablePlatformGateways();
    const tenantA = await makeTenant();
    const storeA = await addStore(tenantA);
    await addGateway("tenant_billing", "mercadopago", tenantA);
    await addGateway("store_checkout", "mercadopago", tenantA, storeA);
    const subscriptionId = await subscribe(tenantA);
    const fixture = providerFixture();
    expect(createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW)).rejects.toThrow("gateway platform_billing");
    const platformGateway = await addGateway("platform_billing", "mercadopago");
    const tenantB = await makeTenant();
    expect(h.db.query(
      `insert into public.payments(level,tenant_id,gateway_account_id,amount_cents,subscription_id,idempotency_key)
       values ('platform_billing',$1::uuid,$2::uuid,1299,$3::uuid,'cross-tenant')`,
      [tenantB, platformGateway, subscriptionId],
    )).rejects.toThrow();
  });

  test("auditoria registra fatos financeiros sem segredos", async () => {
    await disablePlatformGateways();
    const tenantId = await makeTenant();
    await addGateway("platform_billing", "mercadopago");
    const subscriptionId = await subscribe(tenantId);
    const fixture = providerFixture();
    await createPlatformCharge(h.db, actor, subscriptionId, fixture.loader, NOW);
    const rows = await h.db.query(
      "select action,metadata from public.audit_logs where tenant_id=$1::uuid order by created_at", [tenantId],
    );
    const serialized = JSON.stringify(rows);
    expect(serialized).toContain("subscription.created");
    expect(serialized).toContain("billing.charge_created");
    expect(serialized).not.toContain("fixture-pay-");
    expect(serialized.toLowerCase()).not.toContain("secret");
    expect(serialized.toLowerCase()).not.toContain("credential");
    expect(serialized).not.toContain("Authorization");
  });
});
