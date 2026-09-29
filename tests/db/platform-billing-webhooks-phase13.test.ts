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
import { createPlatformSubscription } from "../../apps/web/src/lib/server/platform-billing.subscription.server.ts";
import { setupDatabase, type Harness } from "./harness.ts";

let h: Harness;
let planId = "";
let gatewayId = "";
let counter = 0;
let providerStatus: PaymentStatus = "pending";
const actor = "20000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-18T18:00:00Z");

function provider(): PaymentProvider {
  return {
    name: "mercadopago",
    createIntent() { return Promise.reject(new Error("not used")); },
    fetchStatus() { return Promise.resolve(providerStatus); },
    verifyWebhook() { return Promise.resolve(true); },
    normalizeWebhook(payload) {
      const body = payload as { eventId: string; paymentId: string; occurredAt: string };
      return Promise.resolve({
        externalEventId: body.eventId, type: "payment.updated",
        providerPaymentId: body.paymentId as ProviderPaymentId,
        status: null, occurredAt: body.occurredAt,
      });
    },
    refund() { return Promise.reject(new Error("not used")); },
  };
}

async function fixture(): Promise<{
  tenantId: string;
  subscriptionId: string;
  paymentId: string;
  providerPaymentId: string;
}> {
  counter += 1;
  const suffix = String(counter);
  const tenant = await h.db.query(
    `insert into public.tenants(slug,name,status)
     values ($1,$2,'active') returning id::text`,
    [`pb-webhook-${suffix}`, `PB Webhook ${suffix}`],
  );
  const tenantId = String(tenant.at(0)?.["id"]);
  const subscription = await createPlatformSubscription(h.db, actor, tenantId, planId, NOW);
  const providerPaymentId = `pb-provider-${suffix}`;
  const payment = await h.db.query(
    `insert into public.payments(
       level,tenant_id,gateway_account_id,provider_payment_id,amount_cents,status,
       subscription_id,idempotency_key
     ) values ('platform_billing',$1::uuid,$2::uuid,$3,2500,'pending',$4::uuid,$5)
     returning id::text`,
    [tenantId, gatewayId, providerPaymentId, subscription.id, `pb-webhook-key-${suffix}`],
  );
  return {
    tenantId, subscriptionId: subscription.id,
    paymentId: String(payment.at(0)?.["id"]), providerPaymentId,
  };
}

async function persist(
  eventId: string,
  providerPaymentId: string,
  occurredAt: string,
): Promise<{ id: string; inserted: boolean }> {
  return persistVerifiedWebhook(h.db, {
    provider: "mercadopago", gatewayAccountId: gatewayId, externalEventId: eventId,
    type: "payment.updated", payload: { eventId, paymentId: providerPaymentId, occurredAt },
    occurredAt,
  });
}

beforeAll(async () => {
  h = await setupDatabase();
  const plan = await h.db.query(
    `insert into public.plans(slug,name,price_cents,active,billing_interval)
     values ('pb-webhook-plan','PB Webhook Plan',2500,true,'monthly') returning id::text`,
  );
  planId = String(plan.at(0)?.["id"]);
  const gateway = await h.db.query(
    `insert into public.gateway_accounts(level,provider,label,status)
     values ('platform_billing','mercadopago','PB Webhook Gateway','active') returning id::text`,
  );
  gatewayId = String(gateway.at(0)?.["id"]);
});

afterAll(async () => { await h.db.close(); });

describe("fase 13 platform_billing webhook e reconciliação", () => {
  test("webhook duplicado persiste um único evento e entra na fila do worker", async () => {
    const item = await fixture();
    const first = await persist("pb-evt-dup", item.providerPaymentId, "2026-09-18T18:00:00Z");
    const second = await persist("pb-evt-dup", item.providerPaymentId, "2026-09-18T18:00:00Z");
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await listRunnableWebhookIds(h.db, 50)).toContain(first.id);
  });

  test("captured ativa assinatura e webhook atrasado não regride para failed/past_due", async () => {
    const item = await fixture();
    providerStatus = "captured";
    const newer = await persist("pb-evt-new", item.providerPaymentId, "2026-09-18T19:00:00Z");
    const first = await processWebhookEvent(h.db, newer.id, { loadProvider: () => Promise.resolve(provider()) });
    expect(first.outcome).toBe("processed");
    expect(first.changed).toBe(true);
    const active = await h.db.query(
      `select status,current_period_started_at is not null started,
         current_period_ends_at is not null ended from public.subscriptions where id=$1::uuid`,
      [item.subscriptionId],
    );
    expect(active.at(0)).toMatchObject({ status: "active", started: true, ended: true });
    providerStatus = "failed";
    const older = await persist("pb-evt-old", item.providerPaymentId, "2026-09-18T17:00:00Z");
    const second = await processWebhookEvent(h.db, older.id, { loadProvider: () => Promise.resolve(provider()) });
    expect(second.outcome).toBe("processed");
    expect(second.changed).toBe(false);
    const unchanged = await h.db.query(
      `select p.status payment_status,s.status subscription_status
       from public.payments p join public.subscriptions s on s.id=p.subscription_id where p.id=$1::uuid`,
      [item.paymentId],
    );
    expect(unchanged.at(0)).toMatchObject({ payment_status: "captured", subscription_status: "active" });
  });

  test("falha financeira aplicada pelo webhook deixa assinatura past_due de forma idempotente", async () => {
    const item = await fixture();
    providerStatus = "failed";
    const event = await persist("pb-evt-failed", item.providerPaymentId, "2026-09-18T18:10:00Z");
    await processWebhookEvent(h.db, event.id, { loadProvider: () => Promise.resolve(provider()) });
    const rows = await h.db.query(
      `select p.status,p.platform_effect_status,s.status subscription_status
       from public.payments p join public.subscriptions s on s.id=p.subscription_id where p.id=$1::uuid`,
      [item.paymentId],
    );
    expect(rows.at(0)).toMatchObject({
      status: "failed", platform_effect_status: "failed", subscription_status: "past_due",
    });
  });

  test("reconciliação captured é idempotente e renova um único período", async () => {
    const item = await fixture();
    providerStatus = "captured";
    const first = await reconcilePaymentStatus(
      h.db, item.paymentId, gatewayId, provider(), item.providerPaymentId as ProviderPaymentId,
    );
    const period = await h.db.query(
      "select current_period_ends_at::text ends_at from public.subscriptions where id=$1::uuid",
      [item.subscriptionId],
    );
    const second = await reconcilePaymentStatus(
      h.db, item.paymentId, gatewayId, provider(), item.providerPaymentId as ProviderPaymentId,
    );
    const periodAgain = await h.db.query(
      "select current_period_ends_at::text ends_at from public.subscriptions where id=$1::uuid",
      [item.subscriptionId],
    );
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(periodAgain.at(0)?.["ends_at"]).toBe(period.at(0)?.["ends_at"]);
  });

  test("reconciliação com gateway/provider payment incorretos não permite IDOR", async () => {
    const item = await fixture();
    const otherGateway = await h.db.query(
      `insert into public.gateway_accounts(level,provider,label,status)
       values ('platform_billing','mercadopago','PB Other Gateway','disabled') returning id::text`,
    );
    expect(reconcilePaymentStatus(
      h.db, item.paymentId, String(otherGateway.at(0)?.["id"]), provider(),
      item.providerPaymentId as ProviderPaymentId,
    )).rejects.toThrow("não pertence");
  });
});
