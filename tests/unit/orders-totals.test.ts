import { describe, expect, test } from "bun:test";
import { calculateOrderTotals, formatOrderNumber } from "../../packages/orders/src/index.ts";

describe("orders totals", () => {
  test("calcula subtotal, desconto, frete e total", () => {
    const totals = calculateOrderTotals([
      { quantity: 2, unitCents: 1299 },
      { quantity: 1, unitCents: 500 },
    ], 300, 1000);
    expect(totals).toEqual({
      subtotalCents: 3098,
      discountCents: 300,
      shippingCents: 1000,
      totalCents: 3798,
    });
  });

  test("desconto nunca deixa subtotal negativo", () => {
    expect(calculateOrderTotals([{ quantity: 1, unitCents: 500 }], 900).totalCents).toBe(0);
  });

  test("formata número amigável", () => {
    expect(formatOrderNumber(42)).toBe("#00000042");
  });
});
