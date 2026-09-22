export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "chargeback";

export type PaymentLevel =
  | "platform_billing"
  | "tenant_billing"
  | "store_checkout";

export type PaymentProviderName = "mercadopago" | "asaas";

export type ProviderPaymentId = string & {
  readonly __brand: "ProviderPaymentId";
};

export type GatewayAccountId = string & {
  readonly __brand: "GatewayAccountId";
};

export interface Payment {
  id: string;
  level: PaymentLevel;
  tenantId: string;
  storeId: string | null;
  gatewayAccountId: GatewayAccountId;
  providerPaymentId: ProviderPaymentId | null;
  amountCents: number;
  currency: "BRL";
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  provider: PaymentProviderName;
  gatewayAccountId: GatewayAccountId;
  externalEventId: string;
  type: string;
  payload: unknown;
  receivedAt: Date;
}

export function webhookDedupeKey(
  event: Pick<WebhookEvent, "provider" | "gatewayAccountId" | "externalEventId">,
): string {
  return `${event.provider}:${event.gatewayAccountId}:${event.externalEventId}`;
}

export type PaymentMethod = "pix" | "boleto";

export interface CreatePaymentIntentInput {
  level: PaymentLevel;
  tenantId: string;
  storeId: string | null;
  gatewayAccountId: GatewayAccountId;
  amountCents: number;
  idempotencyKey?: string;
  description?: string;
  externalReference?: string;
  payerEmail?: string;
  paymentMethod?: PaymentMethod;
  providerCustomerId?: string;
  dueDate?: string;
}

export interface PaymentCheckoutData {
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
}

export interface CreatePaymentIntentResult {
  providerPaymentId: ProviderPaymentId;
  checkout?: PaymentCheckoutData;
}

export interface ProviderWebhookInput {
  rawBody: string;
  headers: Readonly<Record<string, string | undefined>>;
  query?: Readonly<Record<string, string | undefined>>;
}

export interface NormalizedProviderEvent {
  externalEventId: string;
  type: string;
  providerPaymentId: ProviderPaymentId | null;
  status: PaymentStatus | null;
  occurredAt: string | null;
}

export interface RefundPaymentInput {
  providerPaymentId: ProviderPaymentId;
  amountCents?: number;
  idempotencyKey?: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createIntent(
    input: CreatePaymentIntentInput,
   ): Promise<CreatePaymentIntentResult>;
  fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus>;
  verifyWebhook(input: ProviderWebhookInput): Promise<boolean>;
  normalizeWebhook(payload: unknown): Promise<NormalizedProviderEvent>;
  refund(
    input: RefundPaymentInput,
  ): Promise<{ providerPaymentId: ProviderPaymentId }>;
}
