import { describe, expect, test } from "bun:test";
import {
  CouponError,
  evaluateCoupon,
  normalizeCouponInput,
} from "../../packages/marketing/src/index.ts";
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
  test("percentual usa aritmética inteira inclusive em subtotal grande", () => {
    expect(evaluateCoupon(base, 2500).discountCents).toBe(250);
    const subtotal = Number.MAX_SAFE_INTEGER - 91;
    const result = evaluateCoupon({ ...base, discountValue: 37 }, subtotal);
    const expected = Math.floor(subtotal / 100) * 37
      + Math.floor((subtotal % 100) * 37 / 100);
    expect(result.discountCents).toBe(expected);
  });

  test("fixo nunca deixa total negativo", () => {
    const coupon = { ...base, discountType: "fixed" as const, discountValue: 5000 };
    expect(evaluateCoupon(coupon, 1200).discountCents).toBe(1200);
  });

  test("inativo, futuro e expirado são rejeitados", () => {
    const now = new Date("2026-09-18T12:00:00Z");
    expect(() => evaluateCoupon({ ...base, active: false }, 1000, now))
      .toThrow(CouponError);
    expect(() => evaluateCoupon({ ...base, startsAt: "2026-09-19T00:00:00Z" }, 1000, now))
      .toThrow(CouponError);
    expect(() => evaluateCoupon({ ...base, endsAt: "2026-09-18T00:00:00Z" }, 1000, now))
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

  test("normalização rejeita percentual, mínimo e datas inválidos", () => {
    const input = {
      code: "PROMO10",
      name: "Promo",
      active: true,
      discountType: "percentage" as const,
      discountValue: 101,
      minimumOrderCents: null,
      startsAt: null,
      endsAt: null,
      usageLimit: null,
    };
    expect(() => normalizeCouponInput(input)).toThrow();
    expect(() => normalizeCouponInput({
      ...input,
      discountValue: 10,
      minimumOrderCents: 10.5,
    })).toThrow();
    expect(() => normalizeCouponInput({
      ...input,
      discountValue: 10,
      startsAt: "not-a-date",
    })).toThrow();
  });
});
