import type { PaymentLevel, PaymentProviderName } from "@white-label/payments";

export type GatewayAccountStatus = "active" | "disabled";

export interface GatewayScope {
  level: PaymentLevel;
  tenantId: string | null;
  storeId: string | null;
}

export interface SafeGatewayAccount {
  id: string;
  level: PaymentLevel;
  tenantId: string | null;
  storeId: string | null;
  provider: PaymentProviderName;
  label: string;
  publicIdentifier: string | null;
  status: GatewayAccountStatus;
  configured: boolean;
  webhookConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ControlGatewayWorkspace {
  level: "tenant_billing";
  canManage: boolean;
  accounts: SafeGatewayAccount[];
}

export interface CreateGatewayAccountInput {
  provider: PaymentProviderName;
  label: string;
  publicIdentifier: string | null;
  credentials: string;
  webhookSecret: string;
}

export interface UpdateGatewayAccountInput {
  gatewayAccountId: string;
  label: string;
  publicIdentifier: string | null;
  credentials: string;
  webhookSecret: string;
}
