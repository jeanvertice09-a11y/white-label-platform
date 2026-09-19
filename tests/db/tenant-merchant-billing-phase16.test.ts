import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTenantMerchantCharge } from "../../apps/web/src/lib/server/tenant-billing.charge.server.ts";
import { assignControlMerchantPlan } from "../../apps/web/src/lib/server/control-merchants.billing.server.ts";
import { loadStoreEntitlementSnapshot } from "../../packages/billing/src/postgres-entitlements.ts";
import { getLimit, hasFeature } from "../../packages/billing/src/entitlements.ts";
import { setupDatabase, type Harness } from "./harness.ts";
import {
  createProviderLoader,
  createTenantBillingFixture,
  createTenantGateway,
  TENANT_BILLING_ACTOR,
} from "./tenant-billing-fixtures.ts";

let h: Harness;

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript("create table if not exists auth.users(id uuid primary key,email text);");
});

afterAll(async () => { await h.db.close(); });

describe("phase 16 tenant_billing core", () => {
  test("trial real do plano é aplicado e trial válido não cobra", async () => {
    const f = await createTenantBillingFixture(h, { trialDays: 5 });
    await createTenantGateway(h, f.tenantId);
    const subscription = await assignControlMerchantPlan(
      h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, f.planId, true,
    );
    expect(subscription.status).toBe("trialing");
    const rows = await h.db.query(
      "select trial_started_at,trial_ends_at from public.store_subscriptions where id=$1::uuid",
      [subscription.subscriptionId],
    );
    expect(rows.at(0)?.["trial_started_at"]).not.toBeNull();
    expect(rows.at(0)?.["trial_ends_at"]).not.toBeNull();
    const p = createProviderLoader();
    expect(createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, f.tenantId, f.storeId, subscription.subscriptionId, p.loader,
    )).rejects.toThrow("Trial válido");
    expect(p.state.calls).toBe(0);
  });

  test("preço, tenant, store, gateway e provider são exclusivamente server-side", async () => {
    const f = await createTenantBillingFixture(h, { priceCents: 3790 });
    const gatewayId = await createTenantGateway(h, f.tenantId);
    const subscription = await assignControlMerchantPlan(
      h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, f.planId, false,
    );
    const p = createProviderLoader();
    const result = await createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, f.tenantId, f.storeId, subscription.subscriptionId, p.loader,
    );
    expect(result.created).toBe(true);
    expect(p.state.inputs[0]).toMatchObject({
      level: "tenant_billing", tenantId: f.tenantId, storeId: f.storeId,
      gatewayAccountId: gatewayId, amountCents: 3790, paymentMethod: "pix",
    });
    const rows = await h.db.query(
      `select level,tenant_id::text,store_id::text,gateway_account_id::text,
         amount_cents,store_subscription_id::text
       from public.payments where id=$1::uuid`,
      [result.paymentId],
    );
    expect(rows.at(0)).toMatchObject({
      level: "tenant_billing", tenant_id: f.tenantId, store_id: f.storeId,
      gateway_account_id: gatewayId, amount_cents: 3790,
      store_subscription_id: subscription.subscriptionId,
    });
  });

  test("retry e concorrência reutilizam cobrança lógica sem duplicar provider call", async () => {
    const f = await createTenantBillingFixture(h);
    await createTenantGateway(h, f.tenantId);
    const subscription = await assignControlMerchantPlan(
      h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, f.planId, false,
    );
    const retryProvider = createProviderLoader({ failures: 1 });
    expect(createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, f.tenantId, f.storeId, subscription.subscriptionId, retryProvider.loader,
    )).rejects.toThrow("transient");
    const retry = await createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, f.tenantId, f.storeId, subscription.subscriptionId, retryProvider.loader,
    );
    expect(retryProvider.state.calls).toBe(2);
    await h.db.query(
      `update public.store_subscriptions set current_period_ends_at='2026-10-18T00:00:00Z'
       where id=$1::uuid`,
      [subscription.subscriptionId],
    );
    const concurrent = createProviderLoader({ delayMs: 20 });
    const now = new Date("2026-10-19T00:00:00Z");
    const both = await Promise.all([
      createTenantMerchantCharge(h.db, TENANT_BILLING_ACTOR, f.tenantId, f.storeId, subscription.subscriptionId, concurrent.loader, now),
      createTenantMerchantCharge(h.db, TENANT_BILLING_ACTOR, f.tenantId, f.storeId, subscription.subscriptionId, concurrent.loader, now),
    ]);
    expect(new Set(both.map((item) => item.paymentId)).size).toBe(1);
    expect(concurrent.state.calls).toBe(1);
    expect(retry.paymentId).not.toBe(both[0].paymentId);
  });

  test("gateway ausente e Asaas sem customer mapping falham fechados", async () => {
    const missing = await createTenantBillingFixture(h);
    const subMissing = await assignControlMerchantPlan(
      h.db, missing.tenantId, TENANT_BILLING_ACTOR, missing.storeId, missing.planId, false,
    );
    const p = createProviderLoader();
    expect(createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, missing.tenantId, missing.storeId, subMissing.subscriptionId, p.loader,
    )).rejects.toThrow("gateway tenant_billing");
    const asaas = await createTenantBillingFixture(h);
    await createTenantGateway(h, asaas.tenantId, "asaas");
    const subAsaas = await assignControlMerchantPlan(
      h.db, asaas.tenantId, TENANT_BILLING_ACTOR, asaas.storeId, asaas.planId, false,
    );
    expect(createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, asaas.tenantId, asaas.storeId, subAsaas.subscriptionId, p.loader,
    )).rejects.toThrow("customer mapping");
    expect(p.state.calls).toBe(0);
  });

  test("cross-tenant e IDOR não cobram assinatura de outro tenant/store", async () => {
    const a = await createTenantBillingFixture(h);
    const b = await createTenantBillingFixture(h);
    await createTenantGateway(h, a.tenantId);
    await createTenantGateway(h, b.tenantId);
    const subA = await assignControlMerchantPlan(
      h.db, a.tenantId, TENANT_BILLING_ACTOR, a.storeId, a.planId, false,
    );
    const p = createProviderLoader();
    expect(createTenantMerchantCharge(
      h.db, TENANT_BILLING_ACTOR, b.tenantId, b.storeId, subA.subscriptionId, p.loader,
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

  test("troca concorrente mantém uma assinatura atual e preserva ciclo", async () => {
    const f = await createTenantBillingFixture(h);
    const first = await assignControlMerchantPlan(
      h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, f.planId, false,
    );
    await h.db.query(
      `update public.store_subscriptions
       set current_period_started_at='2026-09-01T00:00:00Z',current_period_ends_at='2026-10-01T00:00:00Z'
       where id=$1::uuid`, [first.subscriptionId],
    );
    const template = await h.db.query(
      `select id::text from public.plan_templates
       where active=true and id<>(select template_id from public.tenant_plans where id=$1::uuid)
       order by sort_order,id limit 1`, [f.planId],
    );
    const plan = await h.db.query(
      `insert into public.tenant_plans(
         tenant_id,template_id,slug,name,price_cents,billing_interval,active,trial_enabled,trial_days
       ) values ($1::uuid,$2::uuid,$3,'Upgrade',4900,'monthly',true,false,0) returning id::text`,
      [f.tenantId, String(template.at(0)?.["id"]), `upgrade-${f.storeId.slice(0, 8)}`],
    );
    const nextPlan = String(plan.at(0)?.["id"]);
    const results = await Promise.all([
      assignControlMerchantPlan(h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, nextPlan, false),
      assignControlMerchantPlan(h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, nextPlan, false),
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

  test("entitlements/limits são centrais e trial expirado perde acesso", async () => {
    const f = await createTenantBillingFixture(h, { trialDays: 2 });
    const t = await h.db.query("select template_id::text from public.tenant_plans where id=$1::uuid", [f.planId]);
    const templateId = String(t.at(0)?.["template_id"]);
    await h.db.query(
      `insert into public.plan_template_entitlements(template_id,entitlement_key,enabled)
       values ($1::uuid,'products',true) on conflict (template_id,entitlement_key)
       do update set enabled=true,limit_value=null`, [templateId],
    );
    await h.db.query(
      `insert into public.plan_template_entitlements(template_id,entitlement_key,limit_value)
       values ($1::uuid,'max_products',100) on conflict (template_id,entitlement_key)
       do update set enabled=null,limit_value=100`, [templateId],
    );
    await h.db.query(
      `insert into public.tenant_plan_entitlements(tenant_id,tenant_plan_id,entitlement_key,enabled)
       values ($1::uuid,$2::uuid,'products',true)`, [f.tenantId, f.planId],
    );
    await h.db.query(
      `insert into public.tenant_plan_entitlements(tenant_id,tenant_plan_id,entitlement_key,limit_value)
       values ($1::uuid,$2::uuid,'max_products',20)`, [f.tenantId, f.planId],
    );
    const sub = await assignControlMerchantPlan(
      h.db, f.tenantId, TENANT_BILLING_ACTOR, f.storeId, f.planId, true,
    );
    const valid = await loadStoreEntitlementSnapshot(h.db, { tenantId: f.tenantId, storeId: f.storeId });
    expect(hasFeature(valid, "products")).toBe(true);
    expect(getLimit(valid, "max_products")).toBe(20);
    await h.db.query(
      `update public.store_subscriptions
       set trial_started_at=now()-interval '3 days',trial_ends_at=now()-interval '1 day'
       where id=$1::uuid`,
      [sub.subscriptionId],
    );
    const expired = await loadStoreEntitlementSnapshot(h.db, { tenantId: f.tenantId, storeId: f.storeId });
    expect(hasFeature(expired, "products")).toBe(false);
    expect(getLimit(expired, "max_products")).toBeNull();
  });
});
