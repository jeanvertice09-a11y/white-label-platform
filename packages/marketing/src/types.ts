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
