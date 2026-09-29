import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  PaymentProvider,
  PaymentStatus,
  ProviderPaymentId,
} from "../../packages/payments/src/types.ts";
import {
  listRunnableWebhookIds,
  persistVerifiedWebhook,
  processWebhookEvent,
  reconcilePaymentStatus,
} from "../../packages/payments/src/server.ts";
import { assignControlMerchantPlan } from "../../apps/web/src/lib/server/control-merchants.billing.server.ts";
import { setupDatabase, type Harness } from "./harness.ts";

let h: Harness;
let counter = 0;
let providerStatus: PaymentStatus = "pending";
const actor = "30000000-0000-4000-8000-000000000001";

interface Item {
  tenantId: string;
  storeId: string;
  gatewayId: string;
  subscriptionId: string;
  paymentId: string;
  providerPaymentId: string;
}

function provider(): PaymentProvider {
  return {
    name: "mercadopago",
    createIntent() { return Promise.reject(new Error("not used")); },
    fetchStatus() { return Promise.resolve(providerStatus); },
    verifyWebhook() { return Promise.resolve(true); },
    normalizeWebhook(payload) {
      const body = payload as { eventId: string; paymentId: string; occurredAt: string };
      return Promise.resolve({
        externalEventId: body.eventId,
        type: "payment.updated",
        providerPaymentId: body.paymentId as ProviderPaymentId,
        status: null,
        occurredAt: body.occurredAt,
      });
    },
    refund() { return Promise.reject(new Error("not used")); },
  };
}

async function fixture(): Promise<Item> {
  counter += 1;
  const suffix = String(counter);
  const tenant = await h.db.query(
    `insert into public.tenants(slug,name,status)
     values ($1,$2,'active') returning id::text`,
    [`tb-wh-${suffix}`, `Tenant billing webhook ${suffix}`],
  );
  const tenantId = String(tenant.at(0)?.["id"]);
  const store = await h.db.query(
    `insert into public.stores(tenant_id,slug,name,status)
     values ($1::uuid,$2,$3,'active') returning id::text`,
    [tenantId, `tb-wh-store-${suffix}`, `Store ${suffix}`],
  );
  const storeId = String(store.at(0)?.["id"]);
  const template = await h.db.query(
    "select id::text from public.plan_templates where active=true order by sort_order,id limit 1",
  );
  const plan = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,billing_interval,active,trial_enabled,trial_days
     ) values ($1::uuid,$2::uuid,$3,$4,2500,'monthly',true,false,0) returning id::text`,
    [tenantId, String(template.at(0)?.["id"]), `tb-wh-plan-${suffix}`, `Webhook plan ${suffix}`],
  );
  const subscription = await assignControlMerchantPlan(
    h.db,
    tenantId,
    actor,
    storeId,
    String(plan.at(0)?.["id"]),
    false,
  );
  const gateway = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ('tenant_billing',$1::uuid,null,'mercadopago',$2,'active') returning id::text`,
    [tenantId, `TB webhook ${suffix}`],
  );
  const gatewayId = String(gateway.at(0)?.["id"]);
  const providerPaymentId = `tb-webhook-provider-${suffix}`;
  const payment = await h.db.query(
    `insert into public.payments(
       level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,status,
       store_subscription_id,idempotency_key
     ) values ('tenant_billing',$1::uuid,$2::uuid,$3::uuid,$4,2500,'pending',$5::uuid,$6)
     returning id::text`,
    [tenantId, storeId, gatewayId, providerPaymentId, subscription.subscriptionId, `tb-wh-key-${suffix}`],
  );
  return {
    tenantId,
    storeId,
    gatewayId,
    subscriptionId: subscription.subscriptionId,
    paymentId: String(payment.at(0)?.["id"]),
    providerPaymentId,
  };
}

async function persist(
  item: Item,
  eventId: string,
  occurredAt: string,
): Promise<{ id: string; inserted: boolean }> {
  return persistVerifiedWebhook(h.db, {
    provider: "mercadopago",
    gatewayAccountId: item.gatewayId,
    externalEventId: eventId,
    type: "payment.updated",
    payload: { eventId, paymentId: item.providerPaymentId, occurredAt },
    occurredAt,
  });
}

beforeAll(async () => { h = await setupDatabase(); });
afterAll(async () => { await h.db.close(); });

describe("phase 16 tenant_billing webhook", () => {
  test("webhook duplicado persiste uma vez e é executável pelo worker", async () => {
    const item = await fixture();
    const first = await persist(item, `tb-dup-${String(counter)}`, "2026-09-18T20:00:00Z");
    const second = await persist(item, `tb-dup-${String(counter)}`, "2026-09-18T20:00:00Z");
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await listRunnableWebhookIds(h.db, 100)).toContain(first.id);
  });

  test("captured ativa/renova e evento atrasado failed não regride payment nem assinatura", async () => {
    const item = await fixture();
    providerStatus = "captured";
    const newer = await persist(item, `tb-new-${String(counter)}`, "2026-09-18T21:00:00Z");
    const processed = await processWebhookEvent(h.db, newer.id, {
      loadProvider: () => Promise.resolve(provider()),
    });
    expect(processed.outcome).toBe("processed");
    expect(processed.changed).toBe(true);
    const active = await h.db.query(
      `select p.status payment_status,p.tenant_effect_status,
         s.status subscription_status,s.current_period_ends_at is not null period_set
       from public.payments p
       join public.store_subscriptions s on s.id=p.store_subscription_id
       where p.id=$1::uuid`,
      [item.paymentId],
    );
    expect(active.at(0)).toMatchObject({
      payment_status: "captured",
      tenant_effect_status: "captured",
      subscription_status: "active",
      period_set: true,
    });
    providerStatus = "failed";
    const older = await persist(item, `tb-old-${String(counter)}`, "2026-09-18T19:00:00Z");
    const delayed = await processWebhookEvent(h.db, older.id, {
      loadProvider: () => Promise.resolve(provider()),
    });
    expect(delayed.outcome).toBe("processed");
    expect(delayed.changed).toBe(false);
    const unchanged = await h.db.query(
      `select p.status payment_status,s.status subscription_status
       from public.payments p
       join public.store_subscriptions s on s.id=p.store_subscription_id
       where p.id=$1::uuid`,
      [item.paymentId],
    );
    expect(unchanged.at(0)).toMatchObject({ payment_status: "captured", subscription_status: "active" });
  });

  test("failed deixa assinatura past_due sem inventar suspensão automática", async () => {
    const item = await fixture();
    providerStatus = "failed";
    const event = await persist(item, `tb-failed-${String(counter)}`, "2026-09-18T20:10:00Z");
    await processWebhookEvent(h.db, event.id, { loadProvider: () => Promise.resolve(provider()) });
    const rows = await h.db.query(
      `select p.status,p.tenant_effect_status,s.status subscription_status
       from public.payments p join public.store_subscriptions s on s.id=p.store_subscription_id
       where p.id=$1::uuid`,
      [item.paymentId],
    );
    expect(rows.at(0)).toMatchObject({
      status: "failed",
      tenant_effect_status: "failed",
      subscription_status: "past_due",
    });
  });

  test("reconciliação é idempotente e não duplica período", async () => {
    const item = await fixture();
    providerStatus = "captured";
    const first = await reconcilePaymentStatus(
      h.db,
      item.paymentId,
      item.gatewayId,
      provider(),
      item.providerPaymentId as ProviderPaymentId,
    );
    const period = await h.db.query(
      `select current_period_ends_at::text ends_at from public.store_subscriptions where id=$1::uuid`,
      [item.subscriptionId],
    );
    const second = await reconcilePaymentStatus(
      h.db,
      item.paymentId,
      item.gatewayId,
      provider(),
      item.providerPaymentId as ProviderPaymentId,
    );
    const periodAgain = await h.db.query(
      `select current_period_ends_at::text ends_at from public.store_subscriptions where id=$1::uuid`,
      [item.subscriptionId],
    );
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(periodAgain.at(0)?.["ends_at"]).toBe(period.at(0)?.["ends_at"]);
  });

  test("reconciliação não aceita gateway de outro tenant", async () => {
    const item = await fixture();
    const other = await fixture();
    expect(reconcilePaymentStatus(
      h.db,
      item.paymentId,
      other.gatewayId,
      provider(),
      item.providerPaymentId as ProviderPaymentId,
    )).rejects.toThrow("não pertence");
  });

  test("auditoria do webhook/reconciliação não carrega payload ou segredo", async () => {
    const item = await fixture();
    providerStatus = "captured";
    const event = await persist(item, `tb-audit-${String(counter)}`, "2026-09-18T20:20:00Z");
    await processWebhookEvent(h.db, event.id, { loadProvider: () => Promise.resolve(provider()) });
    const logs = await h.db.query(
      `select action,metadata from public.audit_logs where tenant_id=$1::uuid order by created_at,id`,
      [item.tenantId],
    );
    const serialized = JSON.stringify(logs);
    expect(serialized).toContain("payment.webhook_verified");
    expect(serialized).toContain("tenant_billing.payment_confirmed");
    expect(serialized).not.toContain(item.providerPaymentId);
    expect(serialized.toLowerCase()).not.toContain("secret");
  });
});
