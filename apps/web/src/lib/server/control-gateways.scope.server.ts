import type { PaymentLevel } from "@white-label/payments";
import type { GatewayScope } from "./control-gateways.types.ts";

export function assertGatewayScope(scope: GatewayScope): void {
  const valid =
    (scope.level === "platform_billing" && scope.tenantId === null && scope.storeId === null)
    || (scope.level === "tenant_billing" && scope.tenantId !== null && scope.storeId === null)
    || (scope.level === "store_checkout" && scope.tenantId !== null && scope.storeId !== null);
  if (!valid) throw new Error("Escopo financeiro inválido.");
}

export function controlTenantBillingScope(tenantId: string): GatewayScope {
  return { level: "tenant_billing", tenantId, storeId: null };
}

export function isPaymentLevel(value: string): value is PaymentLevel {
  return value === "platform_billing" || value === "tenant_billing" || value === "store_checkout";
}
