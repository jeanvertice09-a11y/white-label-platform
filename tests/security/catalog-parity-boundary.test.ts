import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const checkoutSource = readFileSync(new URL("../../apps/web/src/lib/server/storefront-checkout.functions.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../../apps/web/src/lib/server/catalog.functions.ts", import.meta.url), "utf8");

describe("catalog parity server boundary", () => {
  test("checkout resolve escopo e valores autoritativos no servidor", () => {
    expect(checkoutSource).toContain("createPublicCatalogContext(getRequestHost())");
    const schema = checkoutSource.slice(checkoutSource.indexOf("const checkoutSchema"), checkoutSource.indexOf("export const createWhatsappOrder"));
    expect(schema).not.toContain("tenantId");
    expect(schema).not.toContain("storeId");
    expect(schema).not.toContain("unitPriceCents");
    expect(schema).not.toContain("discountCents");
    expect(checkoutSource).toContain("getCatalogBehavior(settings)");
    expect(checkoutSource).toContain("item.quantity !== 1");
    expect(checkoutSource).toContain("notes: data.notes");
    expect(checkoutSource).toContain("orders.createFromCart(catalog.scope");
  });

  test("busca, categoria e relacionados permanecem escopados no contexto público", () => {
    expect(catalogSource).toContain("createPublicCatalogContext(getRequestHost())");
    expect(catalogSource).toContain("search: settings.showSearch ? data.search : undefined");
    expect(catalogSource).toContain("categoryId: settings.showCategories ? data.categoryId : undefined");
    expect(catalogSource).toContain("categoryId: product.categoryId");
    expect(catalogSource).toContain("...context.scope");
    expect(catalogSource).toContain("if (!settings.showCategories) throw new Error");
  });
});
