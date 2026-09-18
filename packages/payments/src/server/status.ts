import type { PaymentStatus } from "../types.ts";

const allowed: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  pending: ["authorized", "captured", "failed", "refunded", "chargeback"],
  authorized: ["captured", "failed", "refunded", "chargeback"],
  captured: ["refunded", "chargeback"],
  failed: [],
  refunded: [],
  chargeback: [],
};

export function canAdvancePaymentStatus(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  return current === next || allowed[current].includes(next);
}

export function orderPaymentStatus(
  status: PaymentStatus,
): "pending" | "paid" | "failed" | "refunded" | null {
  switch (status) {
    case "captured":
      return "paid";
    case "failed":
    case "chargeback":
      return "failed";
    case "refunded":
      return "refunded";
    case "pending":
    case "authorized":
      return "pending";
    default:
      return null;
  }
}
