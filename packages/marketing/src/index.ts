export type {
  MarketingScope,
  DiscountType,
  Coupon,
  CouponMutationInput,
  CouponEvaluation,
  MarketingConsentStatus,
  CampaignStatus,
  CampaignSegmentType,
  CampaignRecipientStatus,
  MarketingConsent,
  CampaignMutationInput,
  CampaignListQuery,
  Campaign,
  CampaignPage,
  CampaignRecipient,
  CampaignHistoryItem,
  CampaignDetail,
  ProviderBoundaryRecipient,
  RecordMarketingConsentInput,
} from "./types.ts";
export type {
  MarketingSqlExecutor,
  CouponRepository,
  CampaignRepository,
} from "./repository.ts";
export {
  CouponError,
  normalizeCouponCode,
  normalizeCouponInput,
  evaluateCoupon,
} from "./coupons.ts";
export { createCouponRepository } from "./postgres.ts";
export { createCampaignRepository } from "./campaigns-postgres.ts";
