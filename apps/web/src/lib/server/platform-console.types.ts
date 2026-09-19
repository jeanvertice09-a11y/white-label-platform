export interface MasterConsoleData {
  metrics: {
    tenants: number;
    activeTenants: number;
    trialTenants: number;
    activeStores: number;
    activeSubscriptions: number;
    paidCents: number;
    activeDomains: number;
  };
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    trialEndsAt: string | null;
    storeCount: number;
    activeStoreCount: number;
    subscriptionStatus: string | null;
    planName: string | null;
    planPriceCents: number | null;
    billingInterval: string | null;
    subscriptionTrialEndsAt: string | null;
    currentPeriodEndsAt: string | null;
  }>;
  payments: Array<{
    id: string;
    tenantName: string | null;
    amountCents: number;
    status: string;
    provider: string | null;
    createdAt: string;
  }>;
  audits: Array<{
    id: string; action: string; resourceType: string; resourceId: string | null;
    tenantId: string | null; actorUserId: string | null; createdAt: string;
  }>;
  domains: Array<{
    id: string; hostname: string; type: string; status: string; tenantId: string;
    storeId: string | null; verifiedAt: string | null; createdAt: string;
  }>;
  gateways: Array<{
    id: string; provider: string; label: string; level: string;
    tenantId: string | null; storeId: string | null; createdAt: string;
  }>;
}

export interface TenantControlDashboardData {
  tenant: {
    id: string; name: string; slug: string; status: string; createdAt: string;
    trialEndsAt: string | null; logoUrl: string | null; primaryColor: string | null; settings: string;
  };
  stores: Array<{
    id: string; name: string; slug: string; status: string; createdAt: string; memberCount: number;
  }>;
  domains: Array<{
    id: string; hostname: string; type: string; status: string;
    storeId: string | null; verifiedAt: string | null;
  }>;
  plans: Array<{
    id: string; slug: string; name: string; priceCents: number; billingInterval: string;
    active: boolean; trialEnabled: boolean; trialDays: number;
  }>;
  gateways: Array<{
    id: string; provider: string; label: string; level: string;
    storeId: string | null; createdAt: string;
  }>;
  members: Array<{ userId: string; role: string; createdAt: string }>;
  audits: Array<{
    id: string; action: string; resourceType: string; resourceId: string | null;
    actorUserId: string | null; createdAt: string;
  }>;
}
