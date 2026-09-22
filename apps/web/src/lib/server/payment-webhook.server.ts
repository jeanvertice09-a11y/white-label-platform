import {
  createCredentialVaultFromEnv,
  loadGatewayProvider,
  persistVerifiedWebhook,
  MercadoPagoProvider,
} from "@white-label/payments/server";
import type { PaymentProviderName, ProviderWebhookInput } from "@white-label/payments";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { enforceRateLimit, RateLimitError } from "./rate-limit.server.ts";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

class WebhookPayloadTooLargeError extends Error {}

export async function handlePaymentWebhook(
  request: Request,
  providerParam: string,
  gatewayAccountId: string,
): Promise<Response> {
  const providerName = paymentProviderName(providerParam);
  if (!providerName || !uuidLike(gatewayAccountId)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const sql = createAdminSqlExecutor();
    const vault = createCredentialVaultFromEnv();
    const loaded = await loadGatewayProvider(
      sql,
      vault,
      providerName,
      gatewayAccountId,
      { writesEnabled: false },
    );
    await enforceRateLimit(sql, `webhook:${providerName}:${gatewayAccountId}`, 120, 60);
    const rawBody = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
    const url = new URL(request.url);
    const input = webhookInput(request, rawBody, url);
    const verified = await loaded.provider.verifyWebhook(input);
    if (!verified) return new Response("Unauthorized", { status: 401 });
    const payload: unknown = JSON.parse(rawBody);
    const normalized = await loaded.provider.normalizeWebhook(payload);
    await persistVerifiedWebhook(sql, {
      provider: providerName,
      gatewayAccountId,
      externalEventId: normalized.externalEventId,
      type: normalized.type,
      payload,
      occurredAt: normalized.occurredAt,
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    if (error instanceof RateLimitError) return new Response("Too many requests", { status: 429 });
    if (error instanceof WebhookPayloadTooLargeError) return new Response("Payload too large", { status: 413 });
    return new Response("Webhook rejected", { status: 400 });
  }
}


export async function handleMercadoPagoStoreWebhook(request: Request): Promise<Response> {
  try {
    const rawBody = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
    const url = new URL(request.url);
    const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("data_id");
    if (!dataId) return new Response("Not found", { status: 404 });
    const sql = createAdminSqlExecutor();
    const rows = await sql.query(
      `select p.gateway_account_id::text
       from public.payments p join public.gateway_accounts ga on ga.id=p.gateway_account_id
       where ga.provider='mercadopago' and ga.level='store_checkout' and ga.status='active'
         and p.provider_payment_id=$1 limit 1`,
      [dataId],
    );
    const gatewayAccountId = rows.at(0)?.["gateway_account_id"];
    if (typeof gatewayAccountId !== "string") return new Response("Not found", { status: 404 });
    await enforceRateLimit(sql, `webhook:mercadopago:${gatewayAccountId}`, 120, 60);
    const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"]?.trim();
    if (!secret) return new Response("Webhook rejected", { status: 400 });
    const verifier = new MercadoPagoProvider({ accessToken: "webhook-verification-only", webhookSecret: secret });
    const input = webhookInput(request, rawBody, url);
    if (!await verifier.verifyWebhook(input)) return new Response("Unauthorized", { status: 401 });
    const payload: unknown = JSON.parse(rawBody);
    const normalized = await verifier.normalizeWebhook(payload);
    if (normalized.providerPaymentId !== dataId) return new Response("Webhook rejected", { status: 400 });
    await persistVerifiedWebhook(sql, {
      provider: "mercadopago", gatewayAccountId, externalEventId: normalized.externalEventId,
      type: normalized.type, payload, occurredAt: normalized.occurredAt,
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    if (error instanceof RateLimitError) return new Response("Too many requests", { status: 429 });
    if (error instanceof WebhookPayloadTooLargeError) return new Response("Payload too large", { status: 413 });
    return new Response("Webhook rejected", { status: 400 });
  }
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const contentLength = Number(declared);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new WebhookPayloadTooLargeError();
  }
  const body = request.body as ReadableStream<Uint8Array> | null;
  if (body === null) throw new Error("Webhook sem body.");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (!result.done) {
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new WebhookPayloadTooLargeError();
      }
      chunks.push(result.value);
    }
  }
  const decoded = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    decoded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(decoded);
}

function paymentProviderName(value: string): PaymentProviderName | null {
  if (value === "mercadopago" || value === "asaas") return value;
  return null;
}

function webhookInput(
  request: Request,
  rawBody: string,
  url: URL,
): ProviderWebhookInput {
  return {
    rawBody,
    headers: {
      "x-signature": request.headers.get("x-signature") ?? undefined,
      "x-request-id": request.headers.get("x-request-id") ?? undefined,
      "asaas-access-token": request.headers.get("asaas-access-token") ?? undefined,
    },
    query: {
      "data.id": url.searchParams.get("data.id") ?? undefined,
      "data_id": url.searchParams.get("data_id") ?? undefined,
    },
  };
}

function uuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
