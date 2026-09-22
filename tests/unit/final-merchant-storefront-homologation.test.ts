import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Product, ProductVariant } from "../../packages/catalog/src/types.ts";
import { storefrontCardPrice } from "../../apps/web/src/features/storefront/product-card.tsx";
import { storefrontStockLimit } from "../../apps/web/src/features/storefront/product-detail.tsx";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

function variant(id: string, priceCents: number, stockQuantity: number): ProductVariant {
  return {
    tenantId: "tenant-a",
    storeId: "store-a",
    id,
    productId: "product-a",
    name: id,
    sku: null,
    attributes: { cor: id },
    priceCents,
    compareAtPriceCents: priceCents + 500,
    costCents: null,
    active: true,
    stockQuantity,
    position: 0,
  };
}

function product(variants: ProductVariant[] = [], stockQuantity = 20): Product {
  return {
    tenantId: "tenant-a",
    storeId: "store-a",
    id: "product-a",
    name: "Produto A",
    slug: "produto-a",
    description: null,
    sku: null,
    categoryId: null,
    priceCents: 2000,
    compareAtPriceCents: null,
    costCents: null,
    active: true,
    trackInventory: true,
    stockQuantity,
    position: 0,
    variants,
    images: [],
  };
}

describe("final merchant/storefront homologation regressions", () => {
  test("seletor público respeita o mesmo teto 999 aceito pelo carrinho e checkout", () => {
    expect(storefrontStockLimit(product([], 5000), undefined)).toBe(999);
    const highStockVariant = variant("variant-high", 1500, 5000);
    expect(storefrontStockLimit(product([highStockVariant]), highStockVariant)).toBe(999);
  });

  test("card com variantes anuncia o menor preço efetivamente comprável", () => {
    const unavailableCheapest = variant("variant-zero", 1000, 0);
    const available = variant("variant-live", 1500, 5);
    expect(storefrontCardPrice(product([unavailableCheapest, available]))).toEqual({
      current: 1500,
      compareAt: 2000,
      prefix: "A partir de ",
    });
  });

  test("controle do carrinho não tenta ultrapassar quantidade 999", () => {
    const cartPanel = source("apps/web/src/features/storefront/cart-panel.tsx");
    expect(cartPanel).toContain("if (next > MAX_CART_QUANTITY) return;");
    expect(cartPanel).toContain("disabled={item.quantity >= MAX_CART_QUANTITY}");
  });

  test("duplicação preserva associação imagem-variante usando a combinação única de atributos", () => {
    const catalogAdmin = source("apps/web/src/lib/server/catalog-admin.functions.ts");
    expect(catalogAdmin).toContain("returning id,attributes");
    expect(catalogAdmin).toContain("left join copied_variants cv");
    expect(catalogAdmin).toContain("cv.attributes is not distinct from source_variant.attributes");
    expect(catalogAdmin).toContain("case when i.variant_id is null then null else cv.id end");
    expect(catalogAdmin).not.toContain("select i.tenant_id,i.store_id,c.id,null,i.object_key");
  });
});
