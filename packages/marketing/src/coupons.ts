import type {
  Coupon,
  CouponEvaluation,
  CouponMutationInput,
} from "./types.ts";

export class CouponError extends Error {
  constructor(readonly code: "INACTIVE" | "NOT_STARTED" | "EXPIRED" | "LIMIT" | "MINIMUM") {
    super(code);
  }
}

export function normalizeCouponCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalized)) {
    throw new Error("Código de cupom inválido");
  }
  return normalized;
}

export function normalizeCouponInput(input: CouponMutationInput): CouponMutationInput {
  const code = normalizeCouponCode(input.code);
  const name = input.name.trim();
  if (!name || name.length > 160) throw new Error("Nome de cupom inválido");
  if (!Number.isInteger(input.discountValue) || input.discountValue < 1) {
    throw new Error("Desconto inválido");
  }
  if (input.discountType === "percentage" && input.discountValue > 100) {
    throw new Error("Percentual deve ficar entre 1 e 100");
  }
  if (input.minimumOrderCents !== null && input.minimumOrderCents < 0) {
    throw new Error("Mínimo inválido");
  }
  if (input.usageLimit !== null && (!Number.isInteger(input.usageLimit) || input.usageLimit < 1)) {
    throw new Error("Limite inválido");
  }
  if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
    throw new Error("Período inválido");
  }
  return { ...input, code, name };
}

export function evaluateCoupon(
  coupon: Coupon,
  subtotalCents: number,
  now = new Date(),
): CouponEvaluation {
  if (!coupon.active) throw new CouponError("INACTIVE");
  const time = now.getTime();
  if (coupon.startsAt && Date.parse(coupon.startsAt) > time) throw new CouponError("NOT_STARTED");
  if (coupon.endsAt && Date.parse(coupon.endsAt) <= time) throw new CouponError("EXPIRED");
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) throw new CouponError("LIMIT");
  if (coupon.minimumOrderCents !== null && subtotalCents < coupon.minimumOrderCents) {
    throw new CouponError("MINIMUM");
  }
  const raw = coupon.discountType === "percentage"
    ? Math.floor(subtotalCents * coupon.discountValue / 100)
    : coupon.discountValue;
  return {
    couponId: coupon.id,
    code: coupon.code,
    discountCents: Math.min(Math.max(raw, 0), subtotalCents),
  };
}
