import { describe, expect, test } from "bun:test";
import {
  buildObjectKey,
  assertKeyBelongsToTenant,
  assertKeyBelongsToStore,
} from "../../packages/storage/src/keys.ts";

describe("storage keys", () => {
  test("key canônica por tenant/store gerada no servidor", () => {
    const key = buildObjectKey({ tenantId: "t1", storeId: "s1", kind: "product", extension: "png" });
    expect(key.startsWith("tenants/t1/stores/s1/product/")).toBe(true);
  });

  test("key fora do tenant rejeitada", () => {
    expect(() => {
      assertKeyBelongsToTenant("tenants/other/x.png", "t1");
    }).toThrow();
  });

  test("key de outra store é rejeitada", () => {
    expect(() => {
      assertKeyBelongsToStore("tenants/t1/stores/s2/product/x.png", "t1", "s1");
    }).toThrow();
  });
});
