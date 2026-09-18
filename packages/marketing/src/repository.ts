import type {
  Campaign,
  CampaignDetail,
  CampaignListQuery,
  CampaignMutationInput,
  CampaignPage,
  CampaignRecipient,
  Coupon,
  CouponMutationInput,
  MarketingConsent,
  MarketingScope,
  ProviderBoundaryRecipient,
  RecordMarketingConsentInput,
} from "./types.ts";

export interface MarketingSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface CouponRepository {
  list(scope: MarketingScope): Promise<Coupon[]>;
  getByCode(scope: MarketingScope, code: string): Promise<Coupon | null>;
  create(scope: MarketingScope, input: CouponMutationInput): Promise<Coupon>;
  update(
    scope: MarketingScope,
    id: string,
    input: CouponMutationInput,
  ): Promise<Coupon | null>;
}

export interface CampaignRepository {
  listPage(
    scope: MarketingScope,
    query: CampaignListQuery,
  ): Promise<CampaignPage>;
  getById(scope: MarketingScope, id: string): Promise<CampaignDetail | null>;
  getRecipientById(
    scope: MarketingScope,
    id: string,
  ): Promise<CampaignRecipient | null>;
  create(
    scope: MarketingScope,
    input: CampaignMutationInput,
    actorUserId?: string | null,
  ): Promise<Campaign>;
  update(
    scope: MarketingScope,
    id: string,
    input: CampaignMutationInput,
    actorUserId?: string | null,
  ): Promise<Campaign | null>;
  cancel(
    scope: MarketingScope,
    id: string,
    actorUserId?: string | null,
  ): Promise<Campaign | null>;
  prepare(
    scope: MarketingScope,
    id: string,
    actorUserId?: string | null,
  ): Promise<Campaign | null>;
  recordConsent(
    scope: MarketingScope,
    input: RecordMarketingConsentInput,
  ): Promise<MarketingConsent>;
  listProviderBoundaryRecipients(
    scope: MarketingScope,
    campaignId: string,
    limit?: number,
  ): Promise<ProviderBoundaryRecipient[]>;
}
