import { describe, expect, test } from "bun:test";
import { asTenantId, asStoreId, isUuid } from "../../packages/tenant/src/branded.ts";

describe("branded ids", () => {
  test("isUuid valida UUID v4", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
  test("asTenantId rejeita não-UUID", () => {
    expect(() => asTenantId("abc")).toThrow();
  });
  test("tipos distintos não se misturam em atribuição nominal", () => {
    const t = asTenantId("550e8400-e29b-41d4-a716-446655440000");
    const s = asStoreId("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
    expect(t).not.toBe(s as unknown as string);
  });
});
