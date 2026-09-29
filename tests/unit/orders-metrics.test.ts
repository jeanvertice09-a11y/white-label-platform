import { describe, expect, test } from "bun:test";
import { calculateAverageTicket } from "../../packages/orders/src/metrics.ts";

describe("merchant dashboard metrics", () => {
  test("ticket médio usa faturamento dividido pelos pedidos válidos", () => {
    expect(calculateAverageTicket(12500, 5)).toBe(2500);
  });

  test("sem pedidos válidos o ticket médio é zero", () => {
    expect(calculateAverageTicket(0, 0)).toBe(0);
  });
});
