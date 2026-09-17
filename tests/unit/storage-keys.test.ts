import { describe, expect, test } from "bun:test";
import { buildObjectKey, assertKeyBelongsToTenant } from "../../packages/storage/src/keys.ts";

describe("storage keys", () => {
  test("key canonica por tenant/store gerada no servidor", () => {
    const k = buildObjectKey({ tenantId: "t1", storeId: "s1", kind: "product", extension: "png" });
    expect(k.startsWith("tenants/t1/stores/s1/product/")).toBe(true);
  });
  test("key fora do tenant rejeitada", () => {
    expect(() => {
      assertKeyBelongsToTenant("tenants/other/x.png", "t1");
    }).toThrow();
  });
});
