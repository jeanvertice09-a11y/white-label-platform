import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const checkoutSource = readFileSync(new URL("../../apps/web/src/lib/server/storefront-checkout.functions.ts", import.meta.url), "utf8");
const orderSource = readFileSync(new URL("../../packages/orders/src/postgres-create.ts", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../../apps/web/src/features/store-admin/catalog-settings-form.tsx", import.meta.url), "utf8");
const trackingSource = readFileSync(new URL("../../apps/web/src/features/storefront/storefront-tracking.tsx", import.meta.url), "utf8");

describe("storefront growth security boundary", () => {
  test("refresh do carrinho não aceita tenant, store, preço ou desconto do browser", () => {
    const schema = checkoutSource.slice(checkoutSource.indexOf("const cartItemSchema"), checkoutSource.indexOf("type CartRequestItem"));
    expect(schema).not.toContain("tenantId");
    expect(schema).not.toContain("storeId");
    expect(schema).not.toContain("unitPriceCents");
    expect(schema).not.toContain("discountCents");
    expect(checkoutSource).toContain("createPublicCatalogContext(getRequestHost())");
    expect(checkoutSource).toContain("getProductById(catalog.scope, item.productId, true)");
  });

  test("quantidade desativada também bloqueia duplicação da mesma seleção", () => {
    expect(checkoutSource).toContain("hasDuplicateSelection(data.items)");
    expect(checkoutSource).toContain("Quantidade personalizada desativada neste catálogo");
  });

  test("pedido público exige categoria e categoria-pai ativas no mesmo tenant/store", () => {
    expect(orderSource).toContain("c.tenant_id=$1 and c.store_id=$2");
    expect(orderSource).toContain("pc.tenant_id=$1 and pc.store_id=$2");
    expect(orderSource).toContain("pc.id=c.parent_id and pc.active=true");
  });

  test("admin não oferece checkout online/Pix decorativo", () => {
    expect(adminSource).not.toContain('<option value="online">');
    expect(adminSource).not.toContain('<option value="both">');
    expect(adminSource).toContain('<option value="whatsapp">WhatsApp</option>');
  });

  test("tracking usa apenas endpoints fixos e não envia PII de checkout", () => {
    expect(trackingSource).toContain("https://connect.facebook.net/en_US/fbevents.js");
    expect(trackingSource).toContain("https://www.googletagmanager.com/gtag/js?id=");
    expect(trackingSource).toContain("https://analytics.tiktok.com/i18n/pixel/events.js");
    expect(trackingSource).toContain("?sdkid=${encodeURIComponent(id)}&lib=ttq");
    expect(trackingSource).not.toContain("customerName");
    expect(trackingSource).not.toContain("customerPhone");
  });
});
