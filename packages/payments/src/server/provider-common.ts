import { timingSafeEqual } from "node:crypto";
import type { PaymentStatus, ProviderPaymentId } from "../types.ts";

export type HttpFetch = typeof fetch;

export function asProviderPaymentId(value: unknown): ProviderPaymentId {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Provider payment id inválido.");
  }
  return String(value) as ProviderPaymentId;
}

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new Error(`Provider HTTP ${String(response.status)}.`);
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Resposta inválida do provider.");
  }
  return body as Record<string, unknown>;
}

export function centsToDecimal(amountCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("Valor de pagamento inválido.");
  }
  return amountCents / 100;
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Campo ${field} ausente na resposta do provider.`);
  }
  return value;
}

export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.length > 64) {
    throw new Error("Chave de idempotência ausente ou inválida.");
  }
  return value;
}

export function normalizeCommonStatus(status: string): PaymentStatus | null {
  switch (status.toLowerCase()) {
    case "pending":
    case "in_process":
    case "in_mediation":
    case "awaiting_risk_analysis":
      return "pending";
    case "authorized":
      return "authorized";
    case "approved":
    case "received":
    case "confirmed":
    case "received_in_cash":
      return "captured";
    case "rejected":
    case "cancelled":
    case "overdue":
      return "failed";
    case "refunded":
      return "refunded";
    case "charged_back":
    case "chargeback_requested":
    case "chargeback_dispute":
    case "awaiting_chargeback_reversal":
      return "chargeback";
    default:
      return null;
  }
}
