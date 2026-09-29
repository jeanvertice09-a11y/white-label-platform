import { describe, expect, test } from "bun:test";
import type { StoreSubscriptionSnapshot } from "@white-label/billing";
import { EntitlementError } from "@white-label/billing";
import { assertConfiguredInventoryEntitlement } from "../../apps/web/src/lib/server/inventory-entitlements.server.ts";

function snapshot(overrides: Partial<StoreSubscriptionSnapshot> = {}): StoreSubscriptionSnapshot {
  return {
    subscriptionId: "10000000-0000-4000-8000-000000000001",
    tenantId: "20000000-0000-4000-8000-000000000001",
    storeId: "30000000-0000-4000-8000-000000000001",
    planId: "40000000-0000-4000-8000-000000000001",
    planName: "Plano teste",
    status: "active",
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    features: {},
    limits: {},
    ...overrides,
  };
}

describe("inventory entitlements", () => {
  test("sem assinatura configurada não inventa bloqueio", () => {
    expect(() => { assertConfiguredInventoryEntitlement(null); }).not.toThrow();
  });

  test("sem regra inventory configurada mantém acesso", () => {
    expect(() => { assertConfiguredInventoryEntitlement(snapshot()); }).not.toThrow();
  });

  test("inventory explicitamente habilitado permite acesso", () => {
    expect(() => { assertConfiguredInventoryEntitlement(snapshot({ features: { inventory: true } })); }).not.toThrow();
  });

  test("inventory explicitamente desabilitado bloqueia", () => {
    try {
      assertConfiguredInventoryEntitlement(snapshot({ features: { inventory: false } }));
      throw new Error("Esperava bloqueio");
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError);
      expect((error as EntitlementError).code).toBe("FEATURE_NOT_INCLUDED");
    }
  });

  test("assinatura suspensa continua bloqueando quando existe snapshot", () => {
    expect(() => {
      assertConfiguredInventoryEntitlement(snapshot({ status: "suspended", features: { inventory: true } }));
    }).toThrow();
  });
});
