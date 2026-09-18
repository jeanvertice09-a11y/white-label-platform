import {
  createCredentialVaultFromEnv,
  loadGatewayProvider,
  persistVerifiedWebhook,
} from "@white-label/payments/server";
import type { PaymentProviderName, ProviderWebhookInput } from "@white-label/payments";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

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
    const rawBody = await request.text();
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
  } catch {
    return new Response("Webhook rejected", { status: 400 });
  }
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
