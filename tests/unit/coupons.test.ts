import { describe, expect, test } from "bun:test";
import { CouponError, evaluateCoupon } from "../../packages/marketing/src/index.ts";
import type { Coupon } from "../../packages/marketing/src/index.ts";

const base: Coupon = {
  id: "coupon",
  tenantId: "tenant",
  storeId: "store",
  code: "PROMO10",
  name: "Promo",
  active: true,
  discountType: "percentage",
  discountValue: 10,
  minimumOrderCents: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usageCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("coupons", () => {
  test("percentual", () => {
    expect(evaluateCoupon(base, 2500).discountCents).toBe(250);
  });

  test("fixo nunca deixa total negativo", () => {
    const coupon = { ...base, discountType: "fixed" as const, discountValue: 5000 };
    expect(evaluateCoupon(coupon, 1200).discountCents).toBe(1200);
  });

  test("expirado é rejeitado", () => {
    const coupon = { ...base, endsAt: "2026-01-01T00:00:00Z" };
    expect(() => evaluateCoupon(coupon, 1000, new Date("2026-09-18T00:00:00Z")))
      .toThrow(CouponError);
  });

  test("limite atingido é rejeitado", () => {
    const coupon = { ...base, usageLimit: 2, usageCount: 2 };
    expect(() => evaluateCoupon(coupon, 1000)).toThrow(CouponError);
  });

  test("mínimo precisa ser respeitado", () => {
    const coupon = { ...base, minimumOrderCents: 2000 };
    expect(() => evaluateCoupon(coupon, 1500)).toThrow(CouponError);
  });
});
