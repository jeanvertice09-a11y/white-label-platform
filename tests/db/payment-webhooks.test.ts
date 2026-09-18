import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
  PaymentProvider,
  PaymentStatus,
  ProviderPaymentId,
} from "../../packages/payments/src/types.ts";
import {
  persistVerifiedWebhook,
  processWebhookEvent,
} from "../../packages/payments/src/server.ts";
import { setupDatabase, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
let gatewayA = "";
let gatewayB = "";
let paymentId = "";
let orderId = "";
let currentStatus: PaymentStatus = "pending";

function provider(): PaymentProvider {
  return {
    name: "mercadopago",
    createIntent() {
      return Promise.reject(new Error("not used"));
    },
    fetchStatus() {
      return Promise.resolve(currentStatus);
    },
    verifyWebhook() {
      return Promise.resolve(true);
    },
    normalizeWebhook(payload) {
      const body = payload as { eventId: string; paymentId: string };
      return Promise.resolve({
        externalEventId: body.eventId,
        type: "payment.updated",
        providerPaymentId: body.paymentId as ProviderPaymentId,
        status: null,
        occurredAt: null,
      });
    },
    refund() {
      return Promise.reject(new Error("not used"));
    },
  };
}

async function persist(eventId: string, account = gatewayA, providerPaymentId = "pay-a") {
  return persistVerifiedWebhook(h.db, {
    provider: "mercadopago",
    gatewayAccountId: account,
    externalEventId: eventId,
    type: "payment.updated",
    payload: { eventId, paymentId: providerPaymentId },
    occurredAt: "2026-09-18T10:00:00Z",
  });
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  const ga = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ('store_checkout',$1::uuid,$2::uuid,'mercadopago','gateway-a','active')
     returning id::text`,
    [ids.tenantA, ids.storeA],
  );
  gatewayA = String(ga.at(0)?.["id"]);
  const gb = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ('store_checkout',$1::uuid,$2::uuid,'mercadopago','gateway-b','active')
     returning id::text`,
    [ids.tenantB, ids.storeB],
  );
  gatewayB = String(gb.at(0)?.["id"]);
  const order = await h.db.query(
    `insert into public.orders(tenant_id,store_id,total_cents)
     values ($1::uuid,$2::uuid,1000) returning id::text`,
    [ids.tenantA, ids.storeA],
  );
  orderId = String(order.at(0)?.["id"]);
  const payment = await h.db.query(
    `insert into public.payments(
       level,tenant_id,store_id,gateway_account_id,provider_payment_id,
       amount_cents,status,order_id
     ) values (
       'store_checkout',$1::uuid,$2::uuid,$3::uuid,'pay-a',1000,'pending',$4::uuid
     ) returning id::text`,
    [ids.tenantA, ids.storeA, gatewayA, orderId],
  );
  paymentId = String(payment.at(0)?.["id"]);
});

afterAll(async () => {
  await h.db.close();
});

describe("fase 11 payment webhooks", () => {
  test("UNIQUE garante uma persistência lógica para evento duplicado", async () => {
    const first = await persist("evt-dup");
    const second = await persist("evt-dup");
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    const rows = await h.db.query(
      `select count(*)::int total from public.webhook_events
       where gateway_account_id=$1::uuid and external_event_id='evt-dup'`,
      [gatewayA],
    );
    expect(rows.at(0)?.["total"]).toBe(1);
  });

  test("dois workers concorrentes aplicam pagamento uma única vez e não tocam Inventory", async () => {
    currentStatus = "captured";
    const event = await persist("evt-concurrent");
    const stockBefore = await h.db.query(
      "select count(*)::int total from public.stock_movements",
    );
    const deps = { loadProvider: () => Promise.resolve(provider()) };
    const results = await Promise.all([
      processWebhookEvent(h.db, event.id, deps),
      processWebhookEvent(h.db, event.id, deps),
    ]);
    expect(results.filter((result) => result.outcome === "processed")).toHaveLength(1);
    const payment = await h.db.query(
      "select status from public.payments where id=$1::uuid",
      [paymentId],
    );
    expect(payment.at(0)?.["status"]).toBe("captured");
    const order = await h.db.query(
      "select status,payment_status from public.orders where id=$1::uuid",
      [orderId],
    );
    expect(order.at(0)?.["payment_status"]).toBe("paid");
    expect(order.at(0)?.["status"]).toBe("pending");
    const stockAfter = await h.db.query(
      "select count(*)::int total from public.stock_movements",
    );
    expect(stockAfter).toEqual(stockBefore);
  });

  test("evento atrasado não regride captured para pending", async () => {
    currentStatus = "pending";
    const event = await persist("evt-old");
    await processWebhookEvent(h.db, event.id, {
      loadProvider: () => Promise.resolve(provider()),
    });
    const payment = await h.db.query(
      "select status from public.payments where id=$1::uuid",
      [paymentId],
    );
    expect(payment.at(0)?.["status"]).toBe("captured");
  });

  test("gateway de outro tenant não associa payment por UUID conhecido", async () => {
    currentStatus = "refunded";
    const event = await persist("evt-cross", gatewayB, "pay-a");
    const result = await processWebhookEvent(h.db, event.id, {
      loadProvider: () => Promise.resolve(provider()),
    });
    expect(result.outcome).toBe("ignored");
    const payment = await h.db.query(
      "select status from public.payments where id=$1::uuid",
      [paymentId],
    );
    expect(payment.at(0)?.["status"]).toBe("captured");
  });

  test("falha transitória vira retry e depois DLQ sem perder evento", async () => {
    const event = await persist("evt-retry");
    const failing: PaymentProvider = {
      ...provider(),
      fetchStatus() {
        return Promise.reject(new Error("fixture provider outage"));
      },
    };
    const deps = {
      maxAttempts: 2,
      loadProvider: () => Promise.resolve(failing),
    };
    expect((await processWebhookEvent(h.db, event.id, deps)).outcome).toBe("retry");
    await h.db.query(
      `update public.webhook_events set next_attempt_at=now()-interval '1 second'
       where id=$1::uuid`,
      [event.id],
    );
    expect((await processWebhookEvent(h.db, event.id, deps)).outcome).toBe("dead_letter");
    const row = await h.db.query(
      "select status,attempts,last_error from public.webhook_events where id=$1::uuid",
      [event.id],
    );
    expect(row.at(0)?.["status"]).toBe("dead_letter");
    expect(row.at(0)?.["attempts"]).toBe(2);
    expect(row.at(0)?.["last_error"]).toBe("PAYMENT_PROCESSING_FAILED");
  });

  test("audit não contém payload nem segredo de webhook", async () => {
    const serialized = JSON.stringify(await h.db.query(
      `select action,metadata from public.audit_logs
       where resource_type in ('webhook_event','payment')
       order by created_at`,
    ));
    expect(serialized).not.toContain("fixture-webhook-secret");
    expect(serialized).not.toContain("fixture-access-token");
    expect(serialized).not.toContain("Authorization");
  });
});
