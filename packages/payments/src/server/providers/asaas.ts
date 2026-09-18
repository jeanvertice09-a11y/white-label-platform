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
  safeEqual,
} from "../provider-common.ts";
import type { HttpFetch } from "../provider-common.ts";

interface AsaasOptions {
  apiKey: string;
  webhookSecret: string | null;
  baseUrl?: string;
  fetch?: HttpFetch;
  writesEnabled?: boolean;
}

export class AsaasProvider implements PaymentProvider {
  readonly name = "asaas" as const;
  private readonly http: HttpFetch;
  private readonly baseUrl: string;

  constructor(private readonly options: AsaasOptions) {
    if (!options.apiKey) throw new Error("Credencial Asaas ausente.");
    this.http = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api-sandbox.asaas.com/v3";
  }

  async createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<{ providerPaymentId: ProviderPaymentId }> {
    this.assertWritesEnabled();
    if (!input.providerCustomerId || !input.dueDate) {
      throw new Error("Asaas requer providerCustomerId e dueDate.");
    }
    const response = await this.http(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        customer: input.providerCustomerId,
        billingType: paymentMethod(input.paymentMethod),
        value: centsToDecimal(input.amountCents),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
      }),
    });
    const body = await readJson(response);
    return { providerPaymentId: asProviderPaymentId(body["id"]) };
  }

  async fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus> {
    const response = await this.http(
      `${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}/status`,
      { headers: this.headers() },
    );
    const body = await readJson(response);
    const status = normalizeCommonStatus(String(body["status"] ?? ""));
    if (!status) throw new Error("Status Asaas desconhecido.");
    return status;
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<boolean> {
    const secret = this.options.webhookSecret;
    const provided = input.headers["asaas-access-token"];
    return Boolean(secret && provided && safeEqual(secret, provided));
  }

  async normalizeWebhook(payload: unknown): Promise<NormalizedProviderEvent> {
    const body = objectBody(payload);
    const payment = objectBody(body["payment"]);
    const rawStatus = typeof payment["status"] === "string"
      ? payment["status"]
      : "";
    return {
      externalEventId: String(body["id"] ?? ""),
      type: String(body["event"] ?? "unknown"),
      providerPaymentId: payment["id"] === undefined
        ? null
        : asProviderPaymentId(payment["id"]),
      status: normalizeCommonStatus(rawStatus),
      occurredAt: typeof body["dateCreated"] === "string"
        ? body["dateCreated"]
        : null,
    };
  }

  async refund(
    _input: RefundPaymentInput,
  ): Promise<{ providerPaymentId: ProviderPaymentId }> {
    throw new Error(
      "Refund Asaas desabilitado: API oficial não documenta chave idempotente para este endpoint.",
    );
  }

  private headers(): Record<string, string> {
    return {
      access_token: this.options.apiKey,
      "Content-Type": "application/json",
    };
  }

  private assertWritesEnabled(): void {
    if (!this.options.writesEnabled) {
      throw new Error("Operações de escrita Asaas desabilitadas.");
    }
  }
}

function paymentMethod(value: CreatePaymentIntentInput["paymentMethod"]): string {
  if (value === "boleto") return "BOLETO";
  return "PIX";
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
