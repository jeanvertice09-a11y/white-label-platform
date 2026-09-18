import { describe, expect, test } from "bun:test";
import {
  EntitlementError,
  assertFeature,
  assertSubscriptionAccess,
  assertWithinLimit,
  getLimit,
  hasFeature,
} from "../../packages/billing/src/index.ts";
import type { StoreSubscriptionSnapshot } from "../../packages/billing/src/index.ts";

function snapshot(overrides: Partial<StoreSubscriptionSnapshot> = {}): StoreSubscriptionSnapshot {
  return {
    subscriptionId: "sub",
    tenantId: "tenant",
    storeId: "store",
    planId: "plan",
    planName: "Plano",
    status: "active",
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    features: { products: true, reports: false },
    limits: { max_products: 10 },
    ...overrides,
  };
}

describe("entitlements", () => {
  test("trial válido concede acesso sem consultar pagamento", () => {
    const trial = snapshot({
      status: "trialing",
      trialStartedAt: "2026-09-01T00:00:00Z",
      trialEndsAt: "2026-09-30T00:00:00Z",
    });
    expect(hasFeature(trial, "products", new Date("2026-09-18T00:00:00Z"))).toBe(true);
  });

  test("trial expirado bloqueia entitlement", () => {
    const trial = snapshot({ status: "trialing", trialEndsAt: "2026-09-10T00:00:00Z" });
    expect(() => assertSubscriptionAccess(trial, new Date("2026-09-18T00:00:00Z")))
      .toThrow(EntitlementError);
    expect(hasFeature(trial, "products", new Date("2026-09-18T00:00:00Z"))).toBe(false);
  });

  test("feature presente funciona e ausente é bloqueada", () => {
    expect(hasFeature(snapshot(), "products")).toBe(true);
    expect(hasFeature(snapshot(), "reports")).toBe(false);
    expect(() => assertFeature(snapshot(), "reports")).toThrow(EntitlementError);
  });

  test("limite é retornado e respeitado", () => {
    expect(getLimit(snapshot(), "max_products")).toBe(10);
    expect(() => assertWithinLimit(snapshot(), "max_products", 9, 1)).not.toThrow();
    expect(() => assertWithinLimit(snapshot(), "max_products", 10, 1)).toThrow(EntitlementError);
  });

  test("suspended, canceled e ausência de assinatura bloqueiam", () => {
    expect(() => assertSubscriptionAccess(snapshot({ status: "suspended" }))).toThrow(EntitlementError);
    expect(() => assertSubscriptionAccess(snapshot({ status: "canceled" }))).toThrow(EntitlementError);
    expect(() => assertSubscriptionAccess(null)).toThrow(EntitlementError);
  });
});
