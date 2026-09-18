import type { PaymentProvider, PaymentStatus, ProviderPaymentId } from "../types.ts";
import {
  applyPaymentStatus,
  claimWebhook,
  findPaymentTarget,
  markWebhookDone,
  markWebhookFailure,
} from "./webhook-store.ts";
import type { PaymentSql } from "./webhook-store.ts";

export interface WebhookProcessorDeps {
  loadProvider(
    provider: "mercadopago" | "asaas",
    gatewayAccountId: string,
  ): Promise<PaymentProvider>;
  maxAttempts?: number;
}

export interface WebhookProcessResult {
  outcome: "processed" | "ignored" | "retry" | "dead_letter" | "busy";
  changed?: boolean;
}

export async function processWebhookEvent(
  sql: PaymentSql,
  eventId: string,
  deps: WebhookProcessorDeps,
): Promise<WebhookProcessResult> {
  const maxAttempts = deps.maxAttempts ?? 5;
  const event = await claimWebhook(sql, eventId, maxAttempts);
  if (!event) return { outcome: "busy" };
  try {
    const provider = await deps.loadProvider(event.provider, event.gatewayAccountId);
    const normalized = await provider.normalizeWebhook(event.payload);
    if (
      !normalized.externalEventId
      || normalized.externalEventId !== event.externalEventId
      || !normalized.providerPaymentId
    ) {
      await markWebhookDone(sql, event.id, "ignored", null, null);
      return { outcome: "ignored" };
    }
    const status = await provider.fetchStatus(normalized.providerPaymentId);
    const target = await findPaymentTarget(
      sql,
      event.gatewayAccountId,
      normalized.providerPaymentId,
    );
    if (!target) {
      await markWebhookDone(sql, event.id, "ignored", null, status);
      return { outcome: "ignored" };
    }
    const changed = await applyPaymentStatus(
      sql,
      target.id,
      event.gatewayAccountId,
      status,
      null,
    );
    await markWebhookDone(sql, event.id, "processed", target.id, status);
    return { outcome: "processed", changed };
  } catch (error) {
    const result = await markWebhookFailure(
      sql,
      event.id,
      event.attempts,
      maxAttempts,
      safeErrorCode(error),
    );
    return { outcome: result };
  }
}

export async function reconcilePaymentStatus(
  sql: PaymentSql,
  paymentId: string,
  gatewayAccountId: string,
  provider: PaymentProvider,
  providerPaymentId: ProviderPaymentId,
): Promise<{ status: PaymentStatus; changed: boolean }> {
  const status = await provider.fetchStatus(providerPaymentId);
  const changed = await applyPaymentStatus(
    sql,
    paymentId,
    gatewayAccountId,
    status,
    null,
  );
  return { status, changed };
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Provider HTTP ")) {
    return error.message.slice(0, 40);
  }
  return "PAYMENT_PROCESSING_FAILED";
}
