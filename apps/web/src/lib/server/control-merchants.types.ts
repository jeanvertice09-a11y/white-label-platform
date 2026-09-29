export type ControlStoreStatus = "draft" | "active" | "suspended";
export type ControlSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

export interface ControlMerchantListItem {
  id: string;
  name: string;
  slug: string;
  status: ControlStoreStatus;
  createdAt: string;
  ownerUserId: string | null;
  ownerEmail: string | null;
  memberCount: number;
  domainCount: number;
  subscriptionId: string | null;
  subscriptionStatus: ControlSubscriptionStatus | null;
  planId: string | null;
  planName: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

export interface ControlMerchantListResult {
  items: ControlMerchantListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ControlMerchantPlanOption {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  billingInterval: string;
  trialEnabled: boolean;
  trialDays: number;
}

export interface ControlMerchantEntitlement {
  key: string;
  name: string;
  kind: "feature" | "limit";
  enabled: boolean | null;
  limitValue: number | null;
}

export interface ControlMerchantPayment {
  id: string;
  status: string;
  amountCents: number;
  provider: string;
  createdAt: string;
}

export interface ControlMerchantDetail {
  merchant: ControlMerchantListItem;
  members: Array<{
    userId: string;
    email: string | null;
    role: string;
    createdAt: string;
  }>;
  domains: Array<{
    id: string;
    hostname: string;
    type: string;
    status: string;
    verifiedAt: string | null;
  }>;
  entitlements: ControlMerchantEntitlement[];
  payments: ControlMerchantPayment[];
}

export interface ControlMerchantWorkspace {
  list: ControlMerchantListResult;
  plans: ControlMerchantPlanOption[];
}
