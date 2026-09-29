import { describe, expect, test } from "bun:test";
import type { StoreSubscriptionSnapshot } from "../../packages/billing/src/commercial-types.ts";
import type { CatalogSettings } from "../../packages/catalog/src/types.ts";
import {
  assertConfiguredCatalogEntitlements,
  resolveConfiguredCatalogLayout,
  resolveConfiguredCatalogSettings,
} from "../../apps/web/src/lib/server/catalog-entitlements.server.ts";

function snapshot(overrides: Partial<StoreSubscriptionSnapshot> = {}): StoreSubscriptionSnapshot {
  return {
    subscriptionId: "subscription-1",
    tenantId: "tenant-a",
    storeId: "store-a",
    planId: "plan-a",
    planName: "Plano",
    status: "active",
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    features: {},
    limits: {},
    ...overrides,
  };
}

function settings(overrides: Partial<CatalogSettings> = {}): CatalogSettings {
  return {
    tenantId: "tenant-a",
    storeId: "store-a",
    layout: "classic",
    primaryColor: "#111111",
    accentColor: "#222222",
    backgroundColor: "#ffffff",
    fontFamily: "system",
    showSearch: true,
    showCategories: true,
    showPrice: true,
    showStock: true,
    labels: {},
    whatsappPhone: null,
    whatsappMessage: "Olá",
    checkoutMode: "whatsapp",
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

describe("catalog configured entitlements", () => {
  test("regra comercial ausente não inventa bloqueio", () => {
    expect(() => {
      assertConfiguredCatalogEntitlements(snapshot(), {
        feature: "products",
        maxProductsUsage: 999,
      });
    }).not.toThrow();
  });

  test("feature products configurada como false bloqueia mutação", () => {
    expect(() => {
      assertConfiguredCatalogEntitlements(snapshot({ features: { products: false } }), {
        feature: "products",
      });
    }).toThrow("products");
  });

  test("feature variants configurada como false bloqueia mutação", () => {
    expect(() => {
      assertConfiguredCatalogEntitlements(snapshot({ features: { variants: false } }), {
        feature: "variants",
      });
    }).toThrow("variants");
  });

  test("assinatura suspensa bloqueia mesmo sem matriz comercial", () => {
    expect(() => {
      assertConfiguredCatalogEntitlements(snapshot({ status: "suspended" }), {
        feature: "products",
      });
    }).toThrow("suspensa");
  });

  test("limites comerciais 20/100/300/1000 bloqueiam exatamente no teto", () => {
    for (const limit of [20, 100, 300, 1000]) {
      expect(() => {
        assertConfiguredCatalogEntitlements(snapshot({ limits: { max_products: limit } }), {
          maxProductsUsage: limit - 1,
          maxProductsIncrement: 1,
        });
      }).not.toThrow();
      expect(() => {
        assertConfiguredCatalogEntitlements(snapshot({ limits: { max_products: limit } }), {
          maxProductsUsage: limit,
          maxProductsIncrement: 1,
        });
      }).toThrow("max_products");
    }
  });

  test("ausência de max_products representa ausência de teto comercial", () => {
    expect(() => {
      assertConfiguredCatalogEntitlements(snapshot({ limits: {} }), {
        maxProductsUsage: 1_000_000,
        maxProductsIncrement: 1,
      });
    }).not.toThrow();
  });

  test("Modern sem entitlement faz fallback seguro para Classic", () => {
    const denied = snapshot({ features: { layouts: false } });
    expect(resolveConfiguredCatalogLayout(denied, "modern")).toBe("classic");
    expect(() => {
      assertConfiguredCatalogEntitlements(denied, { feature: "layouts" });
    }).toThrow("layouts");
  });

  test("Modern permitido permanece Modern e configuração legada sem key continua compatível", () => {
    expect(resolveConfiguredCatalogLayout(snapshot({ features: { layouts: true } }), "modern")).toBe("modern");
    expect(resolveConfiguredCatalogLayout(snapshot(), "modern")).toBe("modern");
  });

  test("checkout online configurado cai para WhatsApp quando online_payments não está incluído", () => {
    const resolved = resolveConfiguredCatalogSettings(
      snapshot({ features: { online_payments: false, layouts: true } }),
      settings({ layout: "modern", checkoutMode: "both" }),
    );
    expect(resolved.layout).toBe("modern");
    expect(resolved.checkoutMode).toBe("whatsapp");
  });

  test("trial válido respeita entitlement configurado", () => {
    const trial = snapshot({
      status: "trialing",
      trialStartedAt: "2026-09-18T00:00:00.000Z",
      trialEndsAt: "2099-01-01T00:00:00.000Z",
      features: { products: true },
    });
    expect(() => {
      assertConfiguredCatalogEntitlements(trial, { feature: "products" });
    }).not.toThrow();
  });
});
