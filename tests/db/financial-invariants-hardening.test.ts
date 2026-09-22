import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { PaymentProvider, ProviderPaymentId } from "../../packages/payments/src/types.ts";
import {
  createCredentialVaultFromKeyring,
  loadGatewayProvider,
  persistVerifiedWebhook,
  processWebhookEvent,
} from "../../packages/payments/src/server.ts";
import { loadGatewayCredentialMaterial } from "../../apps/web/src/lib/server/gateway-credentials.server.ts";
import { setupDatabase, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const vault = createCredentialVaultFromKeyring({ "1": Buffer.alloc(32, 17).toString("base64") });
let gatewayA = "";
let gatewayB = "";
let gatewayAsaas = "";
let paymentA = "";

function fixtureProvider(): PaymentProvider {
  return {
    name: "mercadopago",
    createIntent: () => Promise.reject(new Error("not used")),
    fetchStatus: () => Promise.resolve("captured"),
    verifyWebhook: () => Promise.resolve(true),
    normalizeWebhook(payload) {
      const value = payload as { eventId: string; paymentId: string };
      return Promise.resolve({
        externalEventId: value.eventId,
        type: "payment.updated",
        providerPaymentId: value.paymentId as ProviderPaymentId,
        status: null,
        occurredAt: null,
      });
    },
    refund: () => Promise.reject(new Error("not used")),
  };
}

async function addGateway(
  tenantId: string,
  storeId: string,
  provider: "mercadopago" | "asaas",
  credential: string | null,
): Promise<string> {
  const rows = await h.db.query(
    `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,status)
     values ('store_checkout',$1::uuid,$2::uuid,$3,$4,'active') returning id::text`,
    [tenantId, storeId, provider, `sentinel-${provider}-${tenantId.slice(0, 8)}`],
  );
  const id = String(rows.at(0)?.["id"]);
  if (credential !== null) {
    await h.db.query(
      `insert into private.gateway_account_secrets(
         gateway_account_id,credentials_ciphertext,webhook_secret_ciphertext
       ) values ($1::uuid,$2,$3)
       on conflict (gateway_account_id) do update
       set credentials_ciphertext=excluded.credentials_ciphertext,
           webhook_secret_ciphertext=excluded.webhook_secret_ciphertext`,
      [id, vault.encrypt(credential), vault.encrypt("webhook-secret")],
    );
  }
  return id;
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  gatewayA = await addGateway(ids.tenantA, ids.storeA, "mercadopago", "credential-a");
  gatewayB = await addGateway(ids.tenantB, ids.storeB, "mercadopago", "credential-b");
  gatewayAsaas = await addGateway(ids.tenantA, ids.storeA, "asaas", "credential-asaas");
  const payment = await h.db.query(
    `insert into public.payments(
       level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,status
     ) values ('store_checkout',$1::uuid,$2::uuid,$3::uuid,'same-external-id',1000,'pending')
     returning id::text`,
    [ids.tenantA, ids.storeA, gatewayA],
  );
  paymentA = String(payment.at(0)?.["id"]);
});

afterAll(async () => { await h.db.close(); });

describe("SENTINEL lote 01 financial isolation", () => {
  test("tenant não resolve credencial de gateway de outro tenant", async () => {
    expect(loadGatewayCredentialMaterial(
      h.db, vault,
      { level: "store_checkout", tenantId: ids.tenantA, storeId: ids.storeA },
      gatewayB,
    )).rejects.toThrow("neste escopo");
    const own = await loadGatewayCredentialMaterial(
      h.db, vault,
      { level: "store_checkout", tenantId: ids.tenantA, storeId: ids.storeA },
      gatewayA,
    );
    expect(own.credentials).toBe("credential-a");
    expect(own.credentials).not.toBe("credential-b");
  });

  test("credencial ausente e provider incompatível falham fechados", async () => {
    const missing = await addGateway(ids.tenantA, ids.storeA, "mercadopago", null);
    expect(loadGatewayProvider(h.db, vault, "mercadopago", missing)).rejects.toThrow("não encontrada");
    expect(loadGatewayProvider(h.db, vault, "asaas", gatewayA)).rejects.toThrow("não encontrada");
  });

  test("provider do evento deve ser o provider persistido do gateway", () => {
    expect(persistVerifiedWebhook(h.db, {
      provider: "asaas",
      gatewayAccountId: gatewayA,
      externalEventId: "evt-wrong-provider",
      type: "PAYMENT_RECEIVED",
      payload: {},
      occurredAt: null,
    })).rejects.toThrow();
  });

  test("mesmo external event id é isolado por provider e gateway", async () => {
    const mp = await persistVerifiedWebhook(h.db, {
      provider: "mercadopago", gatewayAccountId: gatewayA,
      externalEventId: "evt-shared", type: "payment.updated",
      payload: { eventId: "evt-shared", paymentId: "same-external-id" }, occurredAt: null,
    });
    const asaas = await persistVerifiedWebhook(h.db, {
      provider: "asaas", gatewayAccountId: gatewayAsaas,
      externalEventId: "evt-shared", type: "PAYMENT_RECEIVED",
      payload: { eventId: "evt-shared", paymentId: "same-external-id" }, occurredAt: null,
    });
    expect(mp.id).not.toBe(asaas.id);
  });

  test("webhook da conta B com mesmo provider payment id não atualiza pagamento A", async () => {
    const event = await persistVerifiedWebhook(h.db, {
      provider: "mercadopago", gatewayAccountId: gatewayB,
      externalEventId: "evt-cross-account", type: "payment.updated",
      payload: { eventId: "evt-cross-account", paymentId: "same-external-id" }, occurredAt: null,
    });
    const result = await processWebhookEvent(h.db, event.id, {
      loadProvider: (provider, gatewayAccountId) => {
        expect(provider).toBe("mercadopago");
        expect(gatewayAccountId).toBe(gatewayB);
        return Promise.resolve(fixtureProvider());
      },
    });
    expect(result.outcome).toBe("ignored");
    const row = await h.db.query("select status from public.payments where id=$1::uuid", [paymentA]);
    expect(row.at(0)?.["status"]).toBe("pending");
  });

  test("retry preserva provider e gateway originais do evento", async () => {
    const event = await persistVerifiedWebhook(h.db, {
      provider: "mercadopago", gatewayAccountId: gatewayA,
      externalEventId: "evt-retry-context", type: "payment.updated",
      payload: { eventId: "evt-retry-context", paymentId: "same-external-id" }, occurredAt: null,
    });
    let calls = 0;
    const deps = {
      maxAttempts: 2,
      loadProvider(provider: "mercadopago" | "asaas", gatewayAccountId: string) {
        calls += 1;
        expect(provider).toBe("mercadopago");
        expect(gatewayAccountId).toBe(gatewayA);
        if (calls === 1) return Promise.reject(new Error("transient"));
        return Promise.resolve(fixtureProvider());
      },
    };
    expect((await processWebhookEvent(h.db, event.id, deps)).outcome).toBe("retry");
    await h.db.query(
      "update public.webhook_events set next_attempt_at=now()-interval '1 second' where id=$1::uuid",
      [event.id],
    );
    expect((await processWebhookEvent(h.db, event.id, deps)).outcome).toBe("processed");
    expect(calls).toBe(2);
  });

  test("service_role não troca gateway/provider/tenant de identidade financeira existente", () => {
    expect(h.db.query(
      "update public.payments set gateway_account_id=$2::uuid where id=$1::uuid",
      [paymentA, gatewayAsaas],
    )).rejects.toThrow("identidade financeira");
    expect(h.db.query(
      "update public.gateway_accounts set provider='asaas' where id=$1::uuid",
      [gatewayA],
    )).rejects.toThrow("identidade financeira");
  });

  test("status regressivo continua rejeitado pela máquina de estados", async () => {
    const event = await persistVerifiedWebhook(h.db, {
      provider: "mercadopago", gatewayAccountId: gatewayA,
      externalEventId: "evt-capture", type: "payment.updated",
      payload: { eventId: "evt-capture", paymentId: "same-external-id" }, occurredAt: null,
    });
    await processWebhookEvent(h.db, event.id, { loadProvider: () => Promise.resolve(fixtureProvider()) });
    const before = await h.db.query("select status from public.payments where id=$1::uuid", [paymentA]);
    expect(before.at(0)?.["status"]).toBe("captured");
    expect(h.db.query(
      "update public.payments set status='pending' where id=$1::uuid",
      [paymentA],
    )).rejects.toThrow("transição de status inválida");
    const after = await h.db.query("select status from public.payments where id=$1::uuid", [paymentA]);
    expect(after.at(0)?.["status"]).toBe("captured");
  });
});
