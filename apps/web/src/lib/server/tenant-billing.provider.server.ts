import {
  createCredentialVaultFromEnv,
  loadGatewayProvider,
} from "@white-label/payments/server";
import type {
  PaymentProvider,
  PaymentProviderName,
} from "@white-label/payments";
import type { ControlSql } from "./control-merchants.shared.server.ts";

export interface TenantGatewayRef {
  id: string;
  provider: PaymentProviderName;
  tenantId: string;
}

export interface TenantProviderLoader {
  load(gateway: TenantGatewayRef): Promise<PaymentProvider>;
}

export function tenantBillingWritesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (env["APP_ENV"] === "production" || env["NODE_ENV"] === "production") return false;
  return env["TENANT_BILLING_SANDBOX_WRITES"] === "YES";
}

export function createTenantProviderLoader(sql: ControlSql): TenantProviderLoader {
  return {
    async load(gateway) {
      const loaded = await loadGatewayProvider(
        sql,
        createCredentialVaultFromEnv(),
        gateway.provider,
        gateway.id,
        {
          writesEnabled: tenantBillingWritesEnabled(),
          asaasBaseUrl: "https://api-sandbox.asaas.com/v3",
        },
      );
      if (
        loaded.level !== "tenant_billing"
        || loaded.tenantId !== gateway.tenantId
        || loaded.storeId !== null
      ) {
        throw new Error("Gateway incompatível com tenant_billing.");
      }
      return loaded.provider;
    },
  };
}
