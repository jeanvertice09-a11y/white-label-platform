import { describe, expect, test } from "bun:test";
import { buildCatalogSql } from "../../scripts/homologation/fixtures/catalog-sql.ts";
import { buildFoundationSql } from "../../scripts/homologation/fixtures/foundation-sql.ts";
import { validateRuntimeConfig } from "../../scripts/homologation/plan.ts";
import { homologationTestConfig } from "../db/homologation-fixture.ts";

describe("homologation deferred media mode", () => {
  test("functional validation does not require unpublished media", () => {
    const config = homologationTestConfig();
    config.resolvedAssets = {};
    config.tenantLogoUrls = { aurora: "", nexo: "" };
    config.mediaOrigin = "";

    expect(() => validateRuntimeConfig(config, { mediaMode: "deferred" })).not.toThrow();
    expect(() => validateRuntimeConfig(config, { mediaMode: "required" })).toThrow();
  });

  test("deferred SQL never persists fake media references", () => {
    const config = homologationTestConfig();
    config.resolvedAssets = {};
    config.tenantLogoUrls = { aurora: "", nexo: "" };

    const catalog = buildCatalogSql(config, "deferred");
    expect(catalog).toContain("insert into public.products");
    expect(catalog).toContain("insert into public.product_variants");
    expect(catalog).not.toContain("insert into public.media_assets");
    expect(catalog).not.toContain("insert into public.product_images");
    expect(catalog).not.toContain("insert into public.store_banners");

    const foundation = buildFoundationSql(config, "deferred");
    expect(foundation).toContain("insert into public.tenant_branding");
    expect(foundation).not.toContain("assets.example.test");
  });
});
