import type { PaymentProvider, PaymentProviderName } from "../types.ts";
import { AsaasProvider } from "./providers/asaas.ts";
import { MercadoPagoProvider } from "./providers/mercadopago.ts";
import type { HttpFetch } from "./provider-common.ts";

export interface ProviderSecrets {
  credentials: string;
  webhookSecret: string | null;
}

export interface ProviderFactoryOptions {
  fetch?: HttpFetch;
  writesEnabled?: boolean;
  asaasBaseUrl?: string;
}

export function createPaymentProvider(
  provider: PaymentProviderName,
  secrets: ProviderSecrets,
  options: ProviderFactoryOptions = {},
): PaymentProvider {
  if (!secrets.credentials) throw new Error("Credencial do gateway ausente.");
  switch (provider) {
    case "mercadopago":
      return new MercadoPagoProvider({
        accessToken: secrets.credentials,
        webhookSecret: secrets.webhookSecret,
        fetch: options.fetch,
        writesEnabled: options.writesEnabled,
      });
    case "asaas":
      return new AsaasProvider({
        apiKey: secrets.credentials,
        webhookSecret: secrets.webhookSecret,
        baseUrl: options.asaasBaseUrl,
        fetch: options.fetch,
        writesEnabled: options.writesEnabled,
      });
    default:
      return assertNever(provider);
  }
}

function assertNever(value: never): never {
  throw new Error(`Provider não suportado: ${String(value)}`);
}
