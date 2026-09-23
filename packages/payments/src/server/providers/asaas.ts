import type {
  CreatePaymentIntentInput,
  NormalizedProviderEvent,
  PaymentProvider,
  PaymentStatus,
  ProviderPaymentId,
  ProviderWebhookInput,
  RefundPaymentInput,
  ProviderCustomerInput,
  PaymentCheckoutData,
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
  baseUrl?: string | undefined;
  fetch?: HttpFetch | undefined;
  writesEnabled?: boolean | undefined;
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
    const providerPaymentId = asProviderPaymentId(body["id"]);
    const checkout = input.paymentMethod === "pix" ? await this.getCheckoutData(providerPaymentId) : null;
    return { providerPaymentId, ...(checkout ? { checkout } : {}) };
  }

  async ensureCustomer(input: ProviderCustomerInput): Promise<string> {
    const query = new URLSearchParams({ externalReference: input.externalReference, limit: "1" });
    const found = await readJson(await this.http(`${this.baseUrl}/customers?${query.toString()}`, { headers: this.headers() }));
    const data = Array.isArray(found["data"]) ? found["data"] as Record<string, unknown>[] : [];
    const existing = data[0]?.["id"];
    if (typeof existing === "string" && existing) return existing;
    this.assertWritesEnabled();
    const created = await readJson(await this.http(`${this.baseUrl}/customers`, { method: "POST", headers: this.headers(), body: JSON.stringify({ name: input.name, cpfCnpj: input.taxId, email: input.email, externalReference: input.externalReference }) }));
    const id = created["id"];
    if (typeof id !== "string" || !id) throw new Error("Asaas não retornou o cliente criado.");
    return id;
  }

  async getCheckoutData(providerPaymentId: ProviderPaymentId): Promise<PaymentCheckoutData | null> {
    const body = await readJson(await this.http(`${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}/pixQrCode`, { headers: this.headers() }));
    return { qrCode: typeof body["payload"] === "string" ? body["payload"] : null, qrCodeBase64: typeof body["encodedImage"] === "string" ? body["encodedImage"] : null, ticketUrl: null, expiresAt: typeof body["expirationDate"] === "string" ? body["expirationDate"] : null };
  }

  async fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus> {
    const response = await this.http(
      `${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}/status`,
      { headers: this.headers() },
    );
    const body = await readJson(response);
    const rawStatus = typeof body["status"] === "string" ? body["status"] : "";
    const status = asaasStatus(rawStatus);
    return status;
  }

  verifyWebhook(input: ProviderWebhookInput): Promise<boolean> {
    const secret = this.options.webhookSecret;
    const provided = input.headers["asaas-access-token"];
    return Promise.resolve(Boolean(secret && provided && safeEqual(secret, provided)));
  }

  normalizeWebhook(payload: unknown): Promise<NormalizedProviderEvent> {
    const body = objectBody(payload);
    const payment = objectBody(body["payment"]);
    const rawStatus = typeof payment["status"] === "string"
      ? payment["status"]
      : "";
    return Promise.resolve({
      externalEventId: textValue(body["id"]),
      type: textValue(body["event"]) || "unknown",
      providerPaymentId: payment["id"] === undefined
        ? null
        : asProviderPaymentId(payment["id"]),
      status: normalizeCommonStatus(rawStatus),
      occurredAt: typeof body["dateCreated"] === "string"
        ? body["dateCreated"]
        : null,
    });
  }

  refund(
    _input: RefundPaymentInput,
  ): Promise<{ providerPaymentId: ProviderPaymentId }> {
    return Promise.reject(new Error(
      "Refund Asaas desabilitado: API oficial não documenta chave idempotente para este endpoint.",
    ));
  }

  private headers(): Record<string, string> {
    return {
      access_token: this.options.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "Kataluu/1.0 (tenant-billing)",
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

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asaasStatus(raw:string): PaymentStatus {const value=raw.toUpperCase();if(value==="RECEIVED"||value==="RECEIVED_IN_CASH")return "captured";if(value==="CONFIRMED")return "authorized";const status=normalizeCommonStatus(raw);if(!status)throw new Error("Status Asaas desconhecido.");return status;}
