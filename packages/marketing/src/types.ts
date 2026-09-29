export interface MarketingScope {
  tenantId: string;
  storeId: string;
}

export type DiscountType = "percentage" | "fixed";

export interface Coupon extends MarketingScope {
  id: string;
  code: string;
  name: string;
  active: boolean;
  discountType: DiscountType;
  discountValue: number;
  minimumOrderCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CouponMutationInput {
  code: string;
  name: string;
  active: boolean;
  discountType: DiscountType;
  discountValue: number;
  minimumOrderCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
}

export interface CouponEvaluation {
  couponId: string;
  code: string;
  discountCents: number;
}

export type MarketingConsentStatus = "opted_in" | "opted_out";
export type CampaignStatus = "draft" | "prepared" | "scheduled" | "cancelled";
export type CampaignSegmentType = "all" | "with_orders" | "without_orders";
export type CampaignRecipientStatus =
  | "queued"
  | "blocked_consent"
  | "cancelled";

export interface MarketingConsent extends MarketingScope {
  id: string;
  customerId: string;
  status: MarketingConsentStatus;
  source: string;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
}

export interface CampaignMutationInput {
  name: string;
  content: string;
  segmentType: CampaignSegmentType;
  scheduledAt: string | null;
}

export interface CampaignListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface Campaign extends MarketingScope {
  id: string;
  name: string;
  content: string;
  status: CampaignStatus;
  segmentType: CampaignSegmentType;
  scheduledAt: string | null;
  preparedAt: string | null;
  cancelledAt: string | null;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPage {
  items: Campaign[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CampaignRecipient extends MarketingScope {
  id: string;
  campaignId: string;
  customerId: string;
  customerName: string;
  status: CampaignRecipientStatus;
  availableAt: string;
  preparedAt: string;
  blockedAt: string | null;
}

export interface CampaignHistoryItem {
  action: string;
  createdAt: string;
}

export interface CampaignDetail extends Campaign {
  recipients: CampaignRecipient[];
  history: CampaignHistoryItem[];
}

export interface ProviderBoundaryRecipient {
  recipientId: string;
  campaignId: string;
  customerId: string;
}

export interface RecordMarketingConsentInput {
  customerId: string;
  status: MarketingConsentStatus;
  source: string;
}
