import { describe, expect, test } from "bun:test";
import {
  hasCatalogLabelConcatenation,
  isLegacyCatalogPath,
  storefrontCategoryPath,
  storefrontProductPath,
} from "../../apps/web/src/lib/storefront-paths.ts";
import { isStorefrontDomainType, rootTargetForDomainType } from "../../apps/web/src/lib/routing-targets.ts";

describe("fase 19 storefront routing", () => {
  test("store_catalog usa / como home sem transformar outros domínios em storefront", () => {
    expect(isStorefrontDomainType("store_catalog")).toBe(true);
    expect(rootTargetForDomainType("store_catalog")).toBeNull();
    expect(isStorefrontDomainType("tenant_site")).toBe(false);
    expect(isStorefrontDomainType("store_admin")).toBe(false);
  });

  test("produto e categoria usam slug real e nunca label concatenada", () => {
    expect(storefrontProductPath("camiseta-preta")).toBe("/produto/camiseta-preta");
    expect(storefrontCategoryPath("camisetas")).toBe("/categoria/camisetas");
    expect(() => storefrontProductPath("Camiseta Loja")).toThrow("Slug público inválido");
  });

  test("/catalog e /catalogo são reconhecidos somente como compatibilidade legada", () => {
    expect(isLegacyCatalogPath("/catalog")).toBe(true);
    expect(isLegacyCatalogPath("/catalogo")).toBe(true);
    expect(isLegacyCatalogPath("/")).toBe(false);
  });

  test("regressão /catalog%20Loja é detectável e não nasce dos builders", () => {
    expect(hasCatalogLabelConcatenation("/catalog%20Loja")).toBe(true);
    expect(hasCatalogLabelConcatenation("/catalog Loja")).toBe(true);
    expect(hasCatalogLabelConcatenation(storefrontProductPath("loja"))).toBe(false);
    expect(hasCatalogLabelConcatenation(storefrontCategoryPath("loja"))).toBe(false);
  });
});
