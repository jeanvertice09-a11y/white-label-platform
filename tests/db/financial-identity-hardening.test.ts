import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createCredentialVaultFromKeyring,
  loadGatewayProvider,
  persistVerifiedWebhook,
  processWebhookEvent,
} from "../../packages/payments/src/server.ts";
import type { PaymentProvider, ProviderPaymentId } from "../../packages/payments/src/types.ts";
import { setupDatabase, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
let gatewayA = "";
let gatewayB = "";
let asaasA = "";
let paymentA = "";

function provider(paymentId: string): PaymentProvider {
  return {
    name: "mercadopago",
    createIntent() { return Promise.reject(new Error("not used")); },
    fetchStatus() { return Promise.resolve("captured"); },
    verifyWebhook() { return Promise.resolve(true); },
    normalizeWebhook(payload) {
      const body = payload as { eventId: string };
      return Promise.resolve({
        externalEventId: body.eventId,
        type: "payment.updated",
        providerPaymentId: paymentId as ProviderPaymentId,
        status: null,
        occurredAt: "2026-09-22T12:00:00Z",
      });
    },
    refund() { return Promise.reject(new Error("not used")); },
  };
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  const accounts = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values
       ('store_checkout',$1::uuid,$2::uuid,'mercadopago','sentinel-a','active'),
       ('store_checkout',$3::uuid,$4::uuid,'mercadopago','sentinel-b','active'),
       ('store_checkout',$1::uuid,$2::uuid,'asaas','sentinel-asaas-a','active')
     returning id::text,provider,tenant_id::text`,
    [ids.tenantA, ids.storeA, ids.tenantB, ids.storeB],
  );
  gatewayA = String(accounts.find((row) => row["provider"] === "mercadopago" && row["tenant_id"] === ids.tenantA)?.["id"]);
  gatewayB = String(accounts.find((row) => row["provider"] === "mercadopago" && row["tenant_id"] === ids.tenantB)?.["id"]);
  asaasA = String(accounts.find((row) => row["provider"] === "asaas")?.["id"]);
  const order = await h.db.query(
    "insert into public.orders(tenant_id,store_id,total_cents) values ($1::uuid,$2::uuid,1000) returning id::text",
    [ids.tenantA, ids.storeA],
  );
  const payment = await h.db.query(
    `insert into public.payments(
       level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,status,order_id
     ) values ('store_checkout',$1::uuid,$2::uuid,$3::uuid,'same-external-id',1000,'pending',$4::uuid)
     returning id::text`,
    [ids.tenantA, ids.storeA, gatewayA, String(order.at(0)?.["id"])],
  );
  paymentA = String(payment.at(0)?.["id"]);
});

afterAll(async () => { await h.db.close(); });

describe("financial identity hardening", () => {
  test("service-role não persiste evento com provider diferente do gateway", () => {
    const rejected = persistVerifiedWebhook(h.db, {
      provider: "asaas",
      gatewayAccountId: gatewayA,
      externalEventId: "wrong-provider",
      type: "PAYMENT_UPDATED",
      payload: {},
      occurredAt: null,
    });
    expect(rejected).rejects.toThrow();
  });

  test("external id igual em tenants diferentes não causa cross-update", async () => {
    const event = await persistVerifiedWebhook(h.db, {
      provider: "mercadopago",
      gatewayAccountId: gatewayB,
      externalEventId: "same-event-id",
      type: "payment.updated",
      payload: { eventId: "same-event-id" },
      occurredAt: null,
    });
    const result = await processWebhookEvent(h.db, event.id, {
      loadProvider: () => Promise.resolve(provider("same-external-id")),
    });
    expect(result.outcome).toBe("ignored");
    const payment = await h.db.query("select status from public.payments where id=$1::uuid", [paymentA]);
    expect(payment.at(0)?.["status"]).toBe("pending");
  });

  test("Mercado Pago e Asaas não compartilham identidade de evento", async () => {
    const mp = await persistVerifiedWebhook(h.db, {
      provider: "mercadopago", gatewayAccountId: gatewayA, externalEventId: "provider-event",
      type: "payment.updated", payload: {}, occurredAt: null,
    });
    const asaas = await persistVerifiedWebhook(h.db, {
      provider: "asaas", gatewayAccountId: asaasA, externalEventId: "provider-event",
      type: "PAYMENT_UPDATED", payload: {}, occurredAt: null,
    });
    expect(mp.id).not.toBe(asaas.id);
    expect(mp.inserted).toBe(true);
    expect(asaas.inserted).toBe(true);
  });

  test("tenant A não vincula payment ao gateway do tenant B", () => {
    const rejected = h.db.query(
      `insert into public.payments(level,tenant_id,store_id,gateway_account_id,amount_cents,status)
       values ('store_checkout',$1::uuid,$2::uuid,$3::uuid,1000,'pending')`,
      [ids.tenantA, ids.storeA, gatewayB],
    );
    expect(rejected).rejects.toThrow();
  });

  test("credencial é resolvida pelo gateway/provider correto e falha fechado no cross-provider", async () => {
    const vault = createCredentialVaultFromKeyring({
      "1": Buffer.alloc(32, 17).toString("base64"),
    });
    await h.db.query(
      `insert into private.gateway_account_secrets(gateway_account_id,credentials_ciphertext)
       values ($1::uuid,$2)
       on conflict (gateway_account_id) do update set credentials_ciphertext=excluded.credentials_ciphertext`,
      [gatewayA, vault.encrypt("tenant-a-only")],
    );
    const loaded = await loadGatewayProvider(h.db, vault, "mercadopago", gatewayA);
    expect(loaded.tenantId).toBe(ids.tenantA);
    const rejected = loadGatewayProvider(h.db, vault, "asaas", gatewayA);
    expect(rejected).rejects.toThrow("Conta de gateway ativa não encontrada");
  });
});
