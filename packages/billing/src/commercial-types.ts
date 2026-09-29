export type EntitlementKind = "feature" | "limit";

export type StoreSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

export interface BillingScope {
  tenantId: string;
  storeId: string;
}

export interface PlanEntitlementValue {
  key: string;
  kind: EntitlementKind;
  name: string;
  unit: string | null;
  enabled: boolean | null;
  limitValue: number | null;
}

export interface PlanTemplateView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  entitlements: PlanEntitlementValue[];
}

export interface TenantCommercialPlan {
  id: string;
  tenantId: string;
  templateId: string;
  templateCode: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: "monthly" | "quarterly" | "yearly";
  active: boolean;
  trialEnabled: boolean;
  trialDays: number;
  displayOrder: number;
  recommended: boolean;
  entitlements: PlanEntitlementValue[];
}

export interface TenantPlanCatalog {
  templates: PlanTemplateView[];
  plans: TenantCommercialPlan[];
}

export interface TenantPlanInput {
  templateId: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: "monthly" | "quarterly" | "yearly";
  active: boolean;
  trialEnabled: boolean;
  trialDays: number;
  displayOrder: number;
  recommended: boolean;
}

export interface TenantPlanEntitlementInput {
  key: string;
  kind: EntitlementKind;
  enabled: boolean | null;
  limitValue: number | null;
}

export interface StoreSubscriptionSnapshot {
  subscriptionId: string;
  tenantId: string;
  storeId: string;
  planId: string;
  planName: string;
  status: StoreSubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export type EntitlementFailureCode =
  | "SUBSCRIPTION_MISSING"
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_PAST_DUE"
  | "SUBSCRIPTION_SUSPENDED"
  | "SUBSCRIPTION_CANCELED"
  | "SUBSCRIPTION_EXPIRED"
  | "FEATURE_NOT_INCLUDED"
  | "LIMIT_NOT_INCLUDED"
  | "LIMIT_REACHED";
