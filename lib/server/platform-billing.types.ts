import type { PaymentProviderName, PaymentStatus } from "@white-label/payments";

export type PlatformSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type BillingInterval = "monthly" | "quarterly" | "yearly";

export interface PlatformPlanView {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  active: boolean;
  billingInterval: BillingInterval | null;
}

export interface PlatformBillingSnapshot {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  tenantTrialEndsAt: string | null;
  subscriptionId: string | null;
  subscriptionStatus: PlatformSubscriptionStatus | null;
  planId: string | null;
  planName: string | null;
  priceCents: number | null;
  billingInterval: BillingInterval | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStartedAt: string | null;
  currentPeriodEndsAt: string | null;
  canceledAt: string | null;
  provider: PaymentProviderName | null;
  paymentStatus: PaymentStatus | null;
  paymentAmountCents: number | null;
  paymentCreatedAt: string | null;
}

export interface PlatformChargeResult {
  paymentId: string;
  status: PaymentStatus;
  provider: PaymentProviderName;
  providerPaymentId: string | null;
  created: boolean;
}
