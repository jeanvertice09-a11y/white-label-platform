import { describe, expect, test } from "bun:test";
import { DEMO_COUNTS, DEMO_STORES, DEMO_TENANTS } from "../../scripts/homologation/fixtures/data.ts";
import { stableUuid } from "../../scripts/homologation/model.ts";
import { expectedAssets, homologationPlan } from "../../scripts/homologation/plan.ts";

describe("homologation seed plan", () => {
  test("define duas White Labels e quatro lojas com os dois layouts reais", () => {
    expect(DEMO_TENANTS).toHaveLength(2);
    expect(DEMO_STORES).toHaveLength(4);
    expect(DEMO_STORES.filter((store) => store.layout === "classic")).toHaveLength(2);
    expect(DEMO_STORES.filter((store) => store.layout === "modern")).toHaveLength(2);
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

  test("manifesto exige exatamente 76 objetos R2 store-scoped e sem duplicação", () => {
    const assets = expectedAssets();
    expect(assets).toHaveLength(76);
    expect(new Set(assets.map((asset) => asset.key)).size).toBe(76);
    for (const asset of assets) expect(asset.key).toMatch(/^tenants\/[0-9a-f-]+\/stores\/[0-9a-f-]+\//);
  });

  test("IDs são determinísticos e o plano documenta bloqueios externos", () => {
    expect(stableUuid("tenant:aurora")).toBe(stableUuid("tenant:aurora"));
    expect(stableUuid("tenant:aurora")).not.toBe(stableUuid("tenant:nexo"));
    const plan = homologationPlan();
    expect(plan.productionBlockers.length).toBeGreaterThanOrEqual(6);
    expect(plan.unsupported.join(" ")).toContain("favicon");
    expect(plan.counts.customers).toBe(48);
    expect(plan.counts.orders).toBe(64);
    expect(plan.counts.payments).toBe(29);
  });
});
