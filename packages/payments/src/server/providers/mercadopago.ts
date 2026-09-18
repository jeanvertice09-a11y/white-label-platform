import { createHmac } from "node:crypto";
import type {
  CreatePaymentIntentInput,
  NormalizedProviderEvent,
  PaymentProvider,
  PaymentStatus,
  ProviderPaymentId,
  ProviderWebhookInput,
  RefundPaymentInput,
} from "../../types.ts";
import {
  asProviderPaymentId,
  centsToDecimal,
  normalizeCommonStatus,
  readJson,
  requireIdempotencyKey,
  safeEqual,
} from "../provider-common.ts";
import type { HttpFetch } from "../provider-common.ts";

const BASE_URL = "https://api.mercadopago.com";

interface MercadoPagoOptions {
  accessToken: string;
  webhookSecret: string | null;
  fetch?: HttpFetch;
  writesEnabled?: boolean;
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;
  private readonly http: HttpFetch;

  constructor(private readonly options: MercadoPagoOptions) {
    if (!options.accessToken) throw new Error("Credencial Mercado Pago ausente.");
    this.http = options.fetch ?? fetch;
  }

  async createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<{ providerPaymentId: ProviderPaymentId }> {
    this.assertWritesEnabled();
    if ((input.paymentMethod ?? "pix") !== "pix" || !input.payerEmail) {
      throw new Error("Mercado Pago: criação preparada somente para Pix com payerEmail.");
    }
    const key = requireIdempotencyKey(input.idempotencyKey);
    const response = await this.http(`${BASE_URL}/v1/payments`, {
      method: "POST",
      headers: this.headers(key),
      body: JSON.stringify({
        transaction_amount: centsToDecimal(input.amountCents),
        description: input.description ?? "Pagamento",
        payment_method_id: "pix",
        external_reference: input.externalReference,
        payer: { email: input.payerEmail },
      }),
    });
    const body = await readJson(response);
    return { providerPaymentId: asProviderPaymentId(body["id"]) };
  }

  async fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus> {
    const response = await this.http(
      `${BASE_URL}/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      { headers: this.headers() },
    );
    const body = await readJson(response);
    const status = normalizeCommonStatus(String(body["status"] ?? ""));
    if (!status) throw new Error("Status Mercado Pago desconhecido.");
    return status;
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<boolean> {
    const secret = this.options.webhookSecret;
    const signature = input.headers["x-signature"];
    const requestId = input.headers["x-request-id"];
    const dataId = input.query?.["data.id"] ?? input.query?.["data_id"];
    if (!secret || !signature || !requestId || !dataId) return false;
    const parts = Object.fromEntries(
      signature.split(",").map((part) => part.trim().split("=", 2)),
    );
    const timestamp = parts["ts"];
    const expected = parts["v1"];
    if (!timestamp || !expected) return false;
    const manifest =
      `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const digest = createHmac("sha256", secret).update(manifest).digest("hex");
    return safeEqual(digest, expected);
  }

  async normalizeWebhook(payload: unknown): Promise<NormalizedProviderEvent> {
    const body = objectBody(payload);
    const data = objectBody(body["data"]);
    return {
      externalEventId: String(body["id"] ?? ""),
      type: String(body["action"] ?? body["type"] ?? "unknown"),
      providerPaymentId: data["id"] === undefined
        ? null
        : asProviderPaymentId(data["id"]),
      status: null,
      occurredAt: typeof body["date_created"] === "string"
        ? body["date_created"]
        : null,
    };
  }

  async refund(
    input: RefundPaymentInput,
  ): Promise<{ providerPaymentId: ProviderPaymentId }> {
    this.assertWritesEnabled();
    const key = requireIdempotencyKey(input.idempotencyKey);
    const body = input.amountCents === undefined
      ? {}
      : { amount: centsToDecimal(input.amountCents) };
    const response = await this.http(
      `${BASE_URL}/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refunds`,
      { method: "POST", headers: this.headers(key), body: JSON.stringify(body) },
    );
    await readJson(response);
    return { providerPaymentId: input.providerPaymentId };
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.accessToken}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    };
  }

  private assertWritesEnabled(): void {
    if (!this.options.writesEnabled) {
      throw new Error("Operações de escrita Mercado Pago desabilitadas.");
    }
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
