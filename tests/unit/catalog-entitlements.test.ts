import { describe, expect, test } from "bun:test";
import type { StoreSubscriptionSnapshot } from "../../packages/billing/src/commercial-types.ts";
import { assertConfiguredCatalogEntitlements } from "../../apps/web/src/lib/server/catalog-entitlements.server.ts";

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

  test("max_products configurado bloqueia criação acima do limite", () => {
    expect(() => {
      assertConfiguredCatalogEntitlements(snapshot({ limits: { max_products: 10 } }), {
        maxProductsUsage: 10,
        maxProductsIncrement: 1,
      });
    }).toThrow("max_products");
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
