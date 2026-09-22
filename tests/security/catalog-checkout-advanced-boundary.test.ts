import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const checkoutSource = readFileSync(new URL("../../apps/web/src/lib/server/storefront-checkout.functions.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../../apps/web/src/lib/server/catalog.functions.ts", import.meta.url), "utf8");
const orderSource = readFileSync(new URL("../../packages/orders/src/postgres-create.ts", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../../apps/web/src/features/store-admin/catalog-settings-form.tsx", import.meta.url), "utf8");
const storefrontSource = readFileSync(new URL("../../apps/web/src/features/storefront/storefront-view.tsx", import.meta.url), "utf8");

describe("advanced catalog checkout boundary", () => {
  test("browser não fornece tenant, store, preço, desconto ou pedido mínimo", () => {
    const schema = checkoutSource.slice(checkoutSource.indexOf("const checkoutSchema"), checkoutSource.indexOf("export const createWhatsappOrder"));
    expect(schema).not.toContain("tenantId"); expect(schema).not.toContain("storeId"); expect(schema).not.toContain("priceCents"); expect(schema).not.toContain("discountCents"); expect(schema).not.toContain("minimumOrderCents");
    expect(checkoutSource).toContain("createPublicCatalogContext(getRequestHost())");
  });

  test("pedido mínimo e campos habilitados são derivados novamente do settings server-side", () => {
    expect(checkoutSource).toContain("getCatalogAdvancedSettings(settings)");
    expect(checkoutSource).toContain("minimumOrderCents: advanced.minimumOrderCents");
    expect(checkoutSource).toContain("advanced.checkoutAskName ? data.customerName : null");
    expect(checkoutSource).toContain("advanced.checkoutAskNotes ? data.notes : null");
  });

  test("SQL resolve preço, variante, estoque e mínimo sem valores comerciais do browser", () => {
    expect(orderSource).toContain("case when i.variant_id is null then p.price_cents else v.price_cents end as unit_cents");
    expect(orderSource).toContain("v.stock_quantity>=i.qty");
    expect(orderSource).toContain("p.subtotal >= $12::bigint");
    expect(orderSource).toContain("c.tenant_id=$1 and c.store_id=$2");
  });

  test("política de ocultar sem estoque é decidida no servidor e não no query payload", () => {
    const schema = catalogSource.slice(catalogSource.indexOf("const querySchema"), catalogSource.indexOf("const slugSchema"));
    expect(schema).not.toContain("inStockOnly");
    expect(catalogSource).toContain("inStockOnly: !advanced.showOutOfStock");
  });

  test("Classic e Modern preservam a mesma configuração avançada responsiva", () => {
    expect(adminSource).toContain('<option value="classic">'); expect(adminSource).toContain('<option value="modern">');
    expect(storefrontSource).toContain("getCatalogAdvancedSettings(data.settings)");
    expect(storefrontSource).toContain("sf__grid--columns-");
  });
});
