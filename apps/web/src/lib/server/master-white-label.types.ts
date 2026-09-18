import type { DomainType } from "@white-label/domains";

export type TenantStatus = "trial" | "active" | "suspended";
export type MutableTenantStatus = "active" | "suspended";
export type DomainStatus = "pending" | "active" | "suspended";
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue; }

export interface MasterWhiteLabelListItem {
  id: string; name: string; slug: string; status: TenantStatus; createdAt: string;
  ownerUserId: string | null; ownerEmail: string | null; storeCount: number; domainCount: number;
}
export interface MasterWhiteLabelListResult {
  items: MasterWhiteLabelListItem[]; total: number; page: number; pageSize: number; pageCount: number;
}
export interface MasterWhiteLabelDetail {
  tenant: {
    id: string; name: string; slug: string; status: TenantStatus; createdAt: string; updatedAt: string;
    trialEndsAt: string | null; logoUrl: string | null; primaryColor: string | null; settings: JsonObject;
  };
  members: Array<{ userId: string; email: string | null; role: string; createdAt: string }>;
  domains: Array<{ id: string; hostname: string; type: DomainType; status: DomainStatus; storeId: string | null; verifiedAt: string | null; createdAt: string }>;
  commercialPlans: Array<{ id: string; slug: string; name: string; templateName: string; active: boolean }>;
  platformSubscription: { status: string; planName: string | null } | null;
  planTemplates: Array<{ id: string; code: string; name: string; active: boolean; entitlementCount: number }>;
}
