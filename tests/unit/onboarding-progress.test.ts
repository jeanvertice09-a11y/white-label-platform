import { describe, expect, test } from "bun:test";
import { deriveOnboardingSteps, onboardingProgress } from "../../apps/web/src/lib/onboarding-progress.ts";

describe("merchant onboarding progress", () => {
  test("derives completion from real facts instead of browser flags", () => {
    const steps = deriveOnboardingSteps({
      hasBasicStore: true,
      hasContact: false,
      hasAppearance: true,
      hasCatalogSettings: true,
      categoryCount: 0,
      productCount: 1,
      hasPublicDomain: true,
      storeActive: true,
    });
    expect(steps.find((step) => step.id === "products")?.complete).toBe(true);
    expect(steps.find((step) => step.id === "contact")?.complete).toBe(false);
    expect(steps.find((step) => step.id === "ready")?.complete).toBe(true);
    expect(onboardingProgress(steps).percent).toBe(100);
  });

  test("does not mark product step complete without products", () => {
    const steps = deriveOnboardingSteps({
      hasBasicStore: true,
      hasContact: true,
      hasAppearance: true,
      hasCatalogSettings: true,
      categoryCount: 2,
      productCount: 0,
      hasPublicDomain: true,
      storeActive: true,
    });
    expect(steps.find((step) => step.id === "products")?.complete).toBe(false);
    expect(steps.find((step) => step.id === "review")?.complete).toBe(false);
    expect(steps.find((step) => step.id === "ready")?.complete).toBe(false);
  });

  test("links only to existing merchant resources", () => {
    const steps = deriveOnboardingSteps({ hasBasicStore: false, hasContact: false, hasAppearance: false, hasCatalogSettings: false, categoryCount: 0, productCount: 0, hasPublicDomain: false, storeActive: false });
    expect(new Set(steps.map((step) => step.href))).toEqual(new Set(["/admin/settings", "/admin/store/appearance", "/admin/store/catalog", "/admin/categories", "/admin/products#importar-produtos", "/admin/store"]));
  });
});
