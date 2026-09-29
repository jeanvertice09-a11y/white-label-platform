import {
  createCredentialVaultFromEnv,
  loadGatewayProvider,
} from "@white-label/payments/server";
import type {
  PaymentProvider,
  PaymentProviderName,
} from "@white-label/payments";
import type { AdminSql } from "./master-white-label.shared.server.ts";

export interface PlatformGatewayRef {
  id: string;
  provider: PaymentProviderName;
}

export interface PlatformProviderLoader {
  load(gateway: PlatformGatewayRef): Promise<PaymentProvider>;
}

export function platformBillingWritesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (env["APP_ENV"] === "production" || env["NODE_ENV"] === "production") return false;
  return env["PLATFORM_BILLING_SANDBOX_WRITES"] === "YES";
}

export function createPlatformProviderLoader(
  sql: AdminSql,
): PlatformProviderLoader {
  return {
    async load(gateway) {
      const loaded = await loadGatewayProvider(
        sql,
        createCredentialVaultFromEnv(),
        gateway.provider,
        gateway.id,
        {
          writesEnabled: platformBillingWritesEnabled(),
          asaasBaseUrl: "https://api-sandbox.asaas.com/v3",
        },
      );
      if (
        loaded.level !== "platform_billing"
        || loaded.tenantId !== null
        || loaded.storeId !== null
      ) {
        throw new Error("Gateway incompatível com platform_billing.");
      }
      return loaded.provider;
    },
  };
}
