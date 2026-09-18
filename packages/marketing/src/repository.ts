import type {
  Coupon,
  CouponMutationInput,
  MarketingScope,
} from "./types.ts";

export interface MarketingSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface CouponRepository {
  list(scope: MarketingScope): Promise<Coupon[]>;
  getByCode(scope: MarketingScope, code: string): Promise<Coupon | null>;
  create(scope: MarketingScope, input: CouponMutationInput): Promise<Coupon>;
  update(scope: MarketingScope, id: string, input: CouponMutationInput): Promise<Coupon | null>;
}
