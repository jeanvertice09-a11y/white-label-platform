import type { Cents } from "./money.ts";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "chargeback";

export type PaymentLevel = "platform_billing" | "tenant_billing" | "store_checkout";
export type PaymentProviderName = "mercadopago" | "asaas";

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
  provider: PaymentProviderName;
  gatewayAccountId: GatewayAccountId;
  externalEventId: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

/** Chave lógica de idempotência: provider + conta + evento externo. */
export function webhookDedupeKey(
  e: Pick<WebhookEvent, "provider" | "gatewayAccountId" | "externalEventId">,
): string {
  return `${e.provider}:${e.gatewayAccountId}:${e.externalEventId}`;
}

export interface CreatePaymentIntentInput {
  level: PaymentLevel;
  tenantId: string;
  storeId: string | null;
  gatewayAccountId: GatewayAccountId;
  amountCents: Cents;
}

export interface ProviderWebhookInput {
  rawBody: string;
  headers: Readonly<Record<string, string | undefined>>;
}

export interface NormalizedProviderEvent {
  externalEventId: string;
  type: string;
  providerPaymentId: ProviderPaymentId | null;
  status: PaymentStatus | null;
}

export interface RefundPaymentInput {
  providerPaymentId: ProviderPaymentId;
  amountCents?: Cents;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createIntent(input: CreatePaymentIntentInput): Promise<{ providerPaymentId: ProviderPaymentId }>;
  fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus>;
  verifyWebhook(input: ProviderWebhookInput): Promise<boolean>;
  normalizeWebhook(payload: unknown): Promise<NormalizedProviderEvent>;
  refund(input: RefundPaymentInput): Promise<{ providerPaymentId: ProviderPaymentId }>;
}
