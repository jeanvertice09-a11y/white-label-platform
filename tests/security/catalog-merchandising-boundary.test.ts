import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const adminSource = readFileSync(new URL("../../apps/web/src/lib/server/catalog-merchandising.functions.ts", import.meta.url), "utf8");
const publicSource = readFileSync(new URL("../../apps/web/src/lib/server/catalog.functions.ts", import.meta.url), "utf8");
const couponSource = readFileSync(new URL("../../packages/marketing/src/coupons.ts", import.meta.url), "utf8");

describe("catalog merchandising security boundary", () => {
  test("mutation deriva tenant/store do contexto autenticado", () => {
    expect(adminSource).toContain("createMerchantCatalogContext(getRequestHost())");
    const schema = adminSource.slice(adminSource.indexOf("const merchandisingSchema"), adminSource.indexOf("async function merchandisingContext"));
    expect(schema).not.toContain("tenantId");
    expect(schema).not.toContain("storeId");
    expect(schema).not.toContain("userId");
    expect(adminSource).toContain("catalog_settings.tenant_id=excluded.tenant_id");
    expect(adminSource).toContain("context.scope.tenantId");
    expect(adminSource).toContain("context.scope.storeId");
  });

  test("storefront recebe somente merchandising já filtrado pela janela no servidor", () => {
    expect(publicSource).toContain("resolvePublicCatalogMerchandising(settings.labels)");
    expect(publicSource).not.toContain("promo.enabled\"] === \"true\"");
  });

  test("cupom continua calculado e validado no domínio server-side", () => {
    expect(couponSource).toContain("evaluateCoupon");
    expect(couponSource).toContain("discountCents");
    expect(couponSource).toContain("usageLimit");
    expect(couponSource).toContain("minimumOrderCents");
  });
});
