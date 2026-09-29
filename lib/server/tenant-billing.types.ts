export interface TenantBillingMetrics {
  subscriptionsActive: number;
  subscriptionsTrialing: number;
  subscriptionsPastDue: number;
  paymentsPending: number;
  paymentsCaptured: number;
  paymentsFailed: number;
  revenueCapturedCents: number;
}

export interface TenantBillingSubscriptionRow {
  subscriptionId: string;
  storeId: string;
  storeName: string;
  planId: string;
  planName: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  lastPaymentStatus: string | null;
  lastPaymentAmountCents: number | null;
  lastPaymentCreatedAt: string | null;
}

export interface TenantBillingWorkspace {
  metrics: TenantBillingMetrics;
  subscriptions: TenantBillingSubscriptionRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  gatewayReady: boolean;
}
