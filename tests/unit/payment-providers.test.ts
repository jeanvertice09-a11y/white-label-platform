import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  AsaasProvider,
  MercadoPagoProvider,
} from "../../packages/payments/src/server.ts";
import type {
  GatewayAccountId,
  ProviderPaymentId,
  ProviderWebhookInput,
} from "../../packages/payments/src/types.ts";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return Object.assign(handler, { preconnect: fetch.preconnect });
}

async function expectReject(promise: Promise<unknown>, fragment: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  if (!(caught instanceof Error)) throw new Error("Expected Error instance.");
  expect(caught.message).toContain(fragment);
}

describe("MercadoPagoProvider", () => {
  test("valida assinatura oficial x-signature", async () => {
    const secret = "fixture-webhook-secret";
    const dataId = "PAYMENTABC123";
    const requestId = "fixture-request-id";
    const timestamp = "1742505638683";
    const manifest =
      `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const digest = createHmac("sha256", secret).update(manifest).digest("hex");
    const provider = new MercadoPagoProvider({
      accessToken: "fixture-access-token",
      webhookSecret: secret,
    });
    const input: ProviderWebhookInput = {
      rawBody: "{}",
      headers: {
        "x-signature": `ts=${timestamp},v1=${digest}`,
        "x-request-id": requestId,
      },
      query: { "data.id": dataId },
    };
    expect(await provider.verifyWebhook(input)).toBe(true);
    expect(await provider.verifyWebhook({
      ...input,
      headers: { ...input.headers, "x-signature": `ts=${timestamp},v1=bad` },
    })).toBe(false);
  });

  test("cria Pix e refund com X-Idempotency-Key somente quando writes habilitado", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = mockFetch((input, init) => {
      calls.push({ url: requestUrl(input), init });
      return Promise.resolve(jsonResponse({ id: "mp-pay-1" }));
    });
    const provider = new MercadoPagoProvider({
      accessToken: "fixture-access-token",
      webhookSecret: "fixture-webhook",
      fetch: fakeFetch,
      writesEnabled: true,
    });
    const created = await provider.createIntent({
      level: "store_checkout",
      tenantId: "tenant",
      storeId: "store",
      gatewayAccountId: "gateway" as GatewayAccountId,
      amountCents: 1234,
      idempotencyKey: "idem-123",
      payerEmail: "buyer@example.test",
      paymentMethod: "pix",
    });
    expect(created.providerPaymentId === ("mp-pay-1" as ProviderPaymentId)).toBe(true);
    expect(new Headers(calls.at(0)?.init?.headers).get("X-Idempotency-Key")).toBe("idem-123");
    await provider.refund({
      providerPaymentId: "mp-pay-1" as ProviderPaymentId,
      idempotencyKey: "refund-123",
    });
    expect(calls.at(1)?.url).toContain("/v1/payments/mp-pay-1/refunds");

    const disabled = new MercadoPagoProvider({
      accessToken: "fixture-access-token",
      webhookSecret: null,
    });
    await expectReject(disabled.createIntent({
      level: "tenant_billing",
      tenantId: "tenant",
      storeId: null,
      gatewayAccountId: "gateway" as GatewayAccountId,
      amountCents: 100,
      idempotencyKey: "x",
      payerEmail: "buyer@example.test",
    }), "desabilitadas");
  });

  test("normaliza webhook sem confiar nele como status final", async () => {
    const provider = new MercadoPagoProvider({
      accessToken: "fixture-access-token",
      webhookSecret: null,
    });
    const event = await provider.normalizeWebhook({
      id: 123,
      action: "payment.updated",
      date_created: "2026-09-18T10:00:00Z",
      data: { id: "999" },
    });
    expect(event.externalEventId).toBe("123");
    expect(event.type).toBe("payment.updated");
    expect(event.providerPaymentId === ("999" as ProviderPaymentId)).toBe(true);
    expect(event.status).toBeNull();
    expect(event.occurredAt).toBe("2026-09-18T10:00:00Z");
  });
});

describe("AsaasProvider", () => {
  test("valida somente asaas-access-token com comparação exata", async () => {
    const provider = new AsaasProvider({
      apiKey: "fixture-api-key",
      webhookSecret: "fixture-auth-token",
    });
    expect(await provider.verifyWebhook({
      rawBody: "{}",
      headers: { "asaas-access-token": "fixture-auth-token" },
    })).toBe(true);
    expect(await provider.verifyWebhook({
      rawBody: "{}",
      headers: {},
    })).toBe(false);
  });

  test("usa contrato oficial sandbox e normaliza evento", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = mockFetch((input, init) => {
      calls.push({ url: requestUrl(input), init });
      return Promise.resolve(jsonResponse({ id: "pay_asaas_1", status: "PENDING" }));
    });
    const provider = new AsaasProvider({
      apiKey: "fixture-api-key",
      webhookSecret: "fixture-auth-token",
      fetch: fakeFetch,
      writesEnabled: true,
    });
    const created = await provider.createIntent({
      level: "store_checkout",
      tenantId: "tenant",
      storeId: "store",
      gatewayAccountId: "gateway" as GatewayAccountId,
      amountCents: 2500,
      providerCustomerId: "cus_fixture",
      dueDate: "2026-09-30",
      paymentMethod: "pix",
    });
    expect(created.providerPaymentId === ("pay_asaas_1" as ProviderPaymentId)).toBe(true);
    expect(calls.at(0)?.url).toBe("https://api-sandbox.asaas.com/v3/payments");
    expect(new Headers(calls.at(0)?.init?.headers).get("access_token")).toBe("fixture-api-key");

    const event = await provider.normalizeWebhook({
      id: "evt_fixture",
      event: "PAYMENT_RECEIVED",
      dateCreated: "2026-09-18T10:00:00Z",
      payment: { id: "pay_asaas_1", status: "RECEIVED" },
    });
    expect(event.status).toBe("captured");
    expect(event.providerPaymentId === ("pay_asaas_1" as ProviderPaymentId)).toBe(true);
  });

  test("refund Asaas falha fechado sem idempotência oficial documentada", async () => {
    const provider = new AsaasProvider({
      apiKey: "fixture-api-key",
      webhookSecret: "fixture-auth-token",
      writesEnabled: true,
    });
    await expectReject(provider.refund({
      providerPaymentId: "pay_asaas_1" as ProviderPaymentId,
    }), "desabilitado");
  });
});
