import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync(new URL("../../apps/web/src/lib/server/merchant-settings.functions.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../../apps/web/src/lib/server/catalog.functions.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../apps/web/src/routes/admin.settings.tsx", import.meta.url), "utf8");

describe("merchant store settings boundary", () => {
  test("mutation deriva tenant/store do contexto autenticado e não do browser", () => {
    expect(settingsSource).toContain("createMerchantCatalogContext(getRequestHost())");
    const schema = settingsSource.slice(settingsSource.indexOf("const profileSchema"), settingsSource.indexOf("type Sql"));
    expect(schema).not.toContain("tenantId");
    expect(schema).not.toContain("storeId");
    expect(schema).not.toContain("userId");
    expect(schema).not.toContain("status");
    expect(settingsSource).toContain("where tenant_id=$1::uuid and id=$2::uuid");
    expect(settingsSource).toContain("where store_settings.tenant_id=excluded.tenant_id");
  });

  test("dados públicos são extraídos por allowlist e dados privados não são publicados", () => {
    expect(catalogSource).toContain("readPublicStoreProfile");
    expect(catalogSource).toContain("select settings from public.store_settings where tenant_id=$1::uuid and store_id=$2::uuid");
    expect(catalogSource).not.toContain("store_settings.*");
  });

  test("status/publicação usa o fluxo existente e domínio/plano ficam somente leitura", () => {
    expect(routeSource).toContain("getMerchantStorefrontStatus");
    expect(settingsSource).toContain("from public.store_subscriptions s");
    expect(settingsSource).toContain("join public.tenant_plans p");
    expect(settingsSource).not.toContain("update public.store_subscriptions");
    expect(settingsSource).not.toContain("update public.domains");
    expect(settingsSource).not.toContain("insert into public.domains");
  });
});
