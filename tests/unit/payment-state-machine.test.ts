import { describe, expect, test } from "bun:test";
import {
  canAdvancePaymentStatus,
  orderPaymentStatus,
} from "../../packages/payments/src/server.ts";

describe("payment state reconciliation", () => {
  test("não permite regressão de estado financeiro", () => {
    expect(canAdvancePaymentStatus("pending", "captured")).toBe(true);
    expect(canAdvancePaymentStatus("authorized", "captured")).toBe(true);
    expect(canAdvancePaymentStatus("captured", "pending")).toBe(false);
    expect(canAdvancePaymentStatus("refunded", "captured")).toBe(false);
    expect(canAdvancePaymentStatus("chargeback", "pending")).toBe(false);
  });

  test("mapeia somente payment_status de Orders, sem status operacional", () => {
    expect(orderPaymentStatus("pending")).toBe("pending");
    expect(orderPaymentStatus("captured")).toBe("paid");
    expect(orderPaymentStatus("refunded")).toBe("refunded");
    expect(orderPaymentStatus("chargeback")).toBe("failed");
  });
});
