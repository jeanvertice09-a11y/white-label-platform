import type { Cents } from "./money.ts";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "chargeback";

export type PaymentLevel = "platform_billing" | "tenant_billing" | "store_checkout";

export type ProviderPaymentId = string & { readonly __brand: "ProviderPaymentId" };
export type GatewayAccountId = string & { readonly __brand: "GatewayAccountId" };

export interface Payment {
  id: string;
  level: PaymentLevel;
  tenantId: string;
  storeId: string | null;
  gatewayAccountId: GatewayAccountId;
  providerPaymentId: ProviderPaymentId | null;
  amountCents: Cents;
  currency: "BRL";
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  provider: "mercadopago" | "asaas";
  gatewayAccountId: GatewayAccountId;
  externalEventId: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

/** Chave lógica de idempotência: provider + conta + evento externo. */
export function webhookDedupeKey(e: Pick<WebhookEvent, "provider" | "gatewayAccountId" | "externalEventId">): string {
  return `${e.provider}:${e.gatewayAccountId}:${e.externalEventId}`;
}

export interface CreatePaymentIntentInput {
  level: PaymentLevel;
  tenantId: string;
  storeId: string | null;
  gatewayAccountId: GatewayAccountId;
  amountCents: Cents;
}

export interface PaymentProvider {
  readonly name: "mercadopago" | "asaas";
  createIntent(input: CreatePaymentIntentInput): Promise<{ providerPaymentId: ProviderPaymentId }>;
  fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus>;
}
