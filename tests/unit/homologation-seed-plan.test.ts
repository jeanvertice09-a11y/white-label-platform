import { describe, expect, test } from "bun:test";
import { DEMO_COUNTS, DEMO_STORES, DEMO_TENANTS } from "../../scripts/homologation/fixtures/data.ts";
import { stableUuid } from "../../scripts/homologation/model.ts";
import { EXPECTED_STORE_TEMPLATES, expectedAssets, homologationPlan, validateRuntimeConfig } from "../../scripts/homologation/plan.ts";
import { homologationTestConfig } from "../db/homologation-fixture.ts";

describe("homologation seed plan", () => {
  test("define duas White Labels e quatro lojas com os dois layouts reais", () => {
    expect(DEMO_TENANTS).toHaveLength(2);
    expect(DEMO_STORES).toHaveLength(4);
    expect(DEMO_STORES.filter((store) => store.layout === "classic")).toHaveLength(2);
    expect(DEMO_STORES.filter((store) => store.layout === "modern")).toHaveLength(2);
  });

  test("fixa o cenário HML em quatro níveis comerciais sem e-commerce", () => {
    expect(EXPECTED_STORE_TEMPLATES).toEqual({
      lume: "monthly_entry",
      botanica: "monthly_intermediate",
      passo: "monthly_complete",
      casa: "complete",
    });
    expect(Object.values(EXPECTED_STORE_TEMPLATES)).not.toContain("complete_ecommerce");
  });

  test("catálogos têm 18 produtos plausíveis e variantes sem combinações duplicadas", () => {
    for (const store of DEMO_STORES) {
      expect(store.products).toHaveLength(18);
      expect(new Set(store.products.map((product) => product.slug)).size).toBe(18);
      expect(store.products.every((product) => !/produto|teste|exemplo/i.test(product.name))).toBe(true);
      for (const product of store.products) {
        const attributes = product.variants.map((variant) => JSON.stringify(variant.attributes));
        expect(new Set(attributes).size).toBe(attributes.length);
      }
    }
    expect(DEMO_COUNTS.products).toBe(72);
    expect(DEMO_COUNTS.variants).toBe(92);
  });

  test("mapeia os 72 produtos para categorias semânticas existentes", () => {
    const expected = {
      lume: [
        "midi-e-longos", "blusas-e-camisas", "calcas-e-blazers", "calcas-e-blazers", "midi-e-longos", "midi-e-longos",
        "blusas-e-camisas", "midi-e-longos", "blusas-e-camisas", "calcas-e-blazers", "blusas-e-camisas", "midi-e-longos",
        "midi-e-longos", "blusas-e-camisas", "calcas-e-blazers", "calcas-e-blazers", "midi-e-longos", "blusas-e-camisas",
      ],
      botanica: [
        "tratamentos", "tratamentos", "protetores", "tratamentos", "tratamentos", "tratamentos", "tratamentos", "tratamentos",
        "hidratacao", "hidratacao", "hidratacao", "tratamentos", "tratamentos", "tratamentos", "tratamentos", "tratamentos",
        "protetores", "hidratacao",
      ],
      passo: [
        "casual", "casual", "casual", "social", "social", "casual", "conforto", "casual", "casual", "social", "social",
        "social", "conforto", "casual", "social", "social", "casual", "conforto",
      ],
      casa: [
        "vasos-e-objetos", "vasos-e-objetos", "vasos-e-objetos", "servir", "cestos-e-caixas", "vasos-e-objetos", "servir",
        "vasos-e-objetos", "vasos-e-objetos", "servir", "cestos-e-caixas", "servir", "vasos-e-objetos", "vasos-e-objetos",
        "servir", "cestos-e-caixas", "vasos-e-objetos", "vasos-e-objetos",
      ],
    } as const;

    for (const store of DEMO_STORES) {
      const categorySlugByKey = new Map(store.categories.map((category) => [category.key, category.slug]));
      expect(store.products.map((product) => categorySlugByKey.get(product.categoryKey))).toEqual([...expected[store.key]]);
    }
  });

  test("manifesto exige exatamente 76 objetos store-scoped e associados", () => {
    const assets = expectedAssets();
    expect(assets).toHaveLength(76);
    expect(new Set(assets.map((asset) => asset.key)).size).toBe(76);
    expect(assets.filter((asset) => asset.kind === "product")).toHaveLength(72);
    expect(assets.filter((asset) => asset.kind === "banner")).toHaveLength(4);
    for (const asset of assets) {
      expect(asset.key).toMatch(/^tenants\/[0-9a-f-]+\/stores\/[0-9a-f-]+\//);
    }
  });

  test("config exige preço e trial explícitos", () => {
    const missingPrice = structuredClone(homologationTestConfig());
    missingPrice.storePlans.lume.priceCents = null;
    expect(() => { validateRuntimeConfig(missingPrice); }).toThrow("priceCents obrigatório");

    const missingTrial = structuredClone(homologationTestConfig());
    missingTrial.storePlans.botanica.trialDays = null;
    expect(() => { validateRuntimeConfig(missingTrial); }).toThrow("trialDays obrigatório");
  });

  test("config rejeita hostname reservado", () => {
    const config = structuredClone(homologationTestConfig());
    config.domains.aurora.tenantSite = "app.kataluu.com.br";
    expect(() => { validateRuntimeConfig(config); }).toThrow();
  });

  test("config rejeita manifesto incompleto", () => {
    const config = structuredClone(homologationTestConfig());
    const first = expectedAssets().at(0);
    if (!first) throw new Error("asset de teste ausente");
    Reflect.deleteProperty(config.resolvedAssets, first.key);
    expect(() => { validateRuntimeConfig(config); }).toThrow("asset ausente no manifesto resolvido");
  });

  test("config rejeita checksum inválido, MIME inválido e conteúdo duplicado", () => {
    const invalid = structuredClone(homologationTestConfig());
    const first = expectedAssets().at(0);
    const second = expectedAssets().at(1);
    if (!first || !second) throw new Error("assets de teste ausentes");
    const firstAsset = invalid.resolvedAssets[first.key];
    if (!firstAsset) throw new Error("asset de teste ausente");
    firstAsset.sha256 = "abc";
    expect(() => { validateRuntimeConfig(invalid); }).toThrow("sha256 inválido");

    const badMime = structuredClone(homologationTestConfig());
    const mimeAsset = badMime.resolvedAssets[first.key];
    if (!mimeAsset) throw new Error("asset de teste ausente");
    Object.assign(mimeAsset, { mimeType: "application/octet-stream" });
    expect(() => { validateRuntimeConfig(badMime); }).toThrow("MIME inválido");

    const duplicate = structuredClone(homologationTestConfig());
    const one = duplicate.resolvedAssets[first.key];
    const two = duplicate.resolvedAssets[second.key];
    if (!one || !two) throw new Error("assets de teste ausentes");
    two.sha256 = one.sha256;
    expect(() => { validateRuntimeConfig(duplicate); }).toThrow("asset duplicado por conteúdo");
  });

  test("IDs são determinísticos e o plano documenta bloqueios externos", () => {
    expect(stableUuid("tenant:aurora")).toBe(stableUuid("tenant:aurora"));
    expect(stableUuid("tenant:aurora")).not.toBe(stableUuid("tenant:nexo"));
    const plan = homologationPlan();
    expect(plan.productionBlockers.length).toBeGreaterThanOrEqual(6);
    expect(plan.counts.customers).toBe(48);
    expect(plan.counts.orders).toBe(64);
    expect(plan.counts.payments).toBe(29);
  });
});
