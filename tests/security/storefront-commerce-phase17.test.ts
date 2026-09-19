import { describe, expect, test } from "bun:test";
import { DomainResolver } from "../../packages/domains/src/index.ts";
import type { DomainRecord, DomainStore } from "../../packages/domains/src/index.ts";
import {
  addCartItem,
  createCart,
  getCatalogPublicMediaUrl,
} from "../../packages/catalog/src/index.ts";
import type { Product } from "../../packages/catalog/src/index.ts";

const TENANT_A = "a1700000-0000-4000-8000-000000000001";
const TENANT_B = "b1700000-0000-4000-8000-000000000001";
const STORE_A = "a1710000-0000-4000-8000-000000000001";
const STORE_B = "b1710000-0000-4000-8000-000000000001";

function record(hostname: string, tenantId: string, storeId: string): DomainRecord {
  return {
    id: crypto.randomUUID(), tenantId, storeId, hostname,
    type: "store_catalog", status: "active", verifiedAt: "2026-09-18T12:00:00.000Z",
  };
}

function domainStore(records: DomainRecord[]): DomainStore {
  return {
    async findByHostname(hostname) {
      await Promise.resolve();
      return records.find((item) => item.hostname === hostname) ?? null;
    },
  };
}

function product(tenantId: string, storeId: string): Product {
  return {
    tenantId, storeId, id: crypto.randomUUID(), name: "Produto", slug: "produto",
    description: null, sku: null, categoryId: null, priceCents: 1000,
    compareAtPriceCents: null, costCents: null, active: true, trackInventory: false,
    stockQuantity: 0, position: 0, variants: [], images: [],
  };
}

describe("fase 17 storefront security", () => {
  test("cada hostname resolve somente o tenant/store do próprio domínio", async () => {
    const resolver = new DomainResolver(domainStore([
      record("a.example.test", TENANT_A, STORE_A),
      record("b.example.test", TENANT_B, STORE_B),
    ]));
    expect((await resolver.resolve("a.example.test"))?.storeId).toBe(STORE_A);
    expect((await resolver.resolve("b.example.test"))?.storeId).toBe(STORE_B);
    expect(await resolver.resolve("unknown.example.test")).toBeNull();
  });

  test("carrinho não aceita produto de outro tenant/store", () => {
    const cart = createCart({ tenantId: TENANT_A, storeId: STORE_A });
    expect(() => addCartItem(cart, product(TENANT_B, STORE_B), null, 1)).toThrow();
  });

  test("URL pública de mídia rejeita object key de outra loja", () => {
    const scope = { tenantId: TENANT_A, storeId: STORE_A };
    const valid = `tenants/${TENANT_A}/stores/${STORE_A}/products/image.webp`;
    const foreign = `tenants/${TENANT_B}/stores/${STORE_B}/products/image.webp`;
    expect(getCatalogPublicMediaUrl(scope, valid)).toContain(encodeURIComponent(STORE_A));
    expect(() => getCatalogPublicMediaUrl(scope, foreign)).toThrow();
  });
});
