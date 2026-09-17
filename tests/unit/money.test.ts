import { describe, expect, test } from "bun:test";
import { toCents, assertIntegerCents } from "../../packages/payments/src/money.ts";
import { webhookDedupeKey } from "../../packages/payments/src/types.ts";

describe("money (cents)", () => {
  test("converte sem float", () => {
    expect(toCents(10.99) as number).toBe(1099);
    expect(() => {
      assertIntegerCents(10.5);
    }).toThrow();
  });
  test("dedupe key de webhook e provider+conta+evento", () => {
    const k = webhookDedupeKey({ provider: "asaas", gatewayAccountId: "g1" as never, externalEventId: "e1" });
    expect(k).toBe("asaas:g1:e1");
  });
});
