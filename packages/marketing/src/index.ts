export type {
  MarketingScope,
  DiscountType,
  Coupon,
  CouponMutationInput,
  CouponEvaluation,
} from "./types.ts";
export type {
  MarketingSqlExecutor,
  CouponRepository,
} from "./repository.ts";
export {
  CouponError,
  normalizeCouponCode,
  normalizeCouponInput,
  evaluateCoupon,
} from "./coupons.ts";
export { createCouponRepository } from "./postgres.ts";
