import { describe, expect, test } from "bun:test";
import type { StoreSubscriptionSnapshot } from "@white-label/billing";
import { EntitlementError } from "@white-label/billing";
import { assertConfiguredOrdersEntitlement } from "../../apps/web/src/lib/server/orders-entitlements.server.ts";

function snapshot(
  overrides: Partial<StoreSubscriptionSnapshot> = {},
): StoreSubscriptionSnapshot {
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

describe("orders entitlements", () => {
  test("sem assinatura configurada não inventa bloqueio", () => {
    expect(() => { assertConfiguredOrdersEntitlement(null); }).not.toThrow();
  });

  test("sem regra orders configurada mantém acesso", () => {
    expect(() => { assertConfiguredOrdersEntitlement(snapshot()); }).not.toThrow();
  });

  test("orders explicitamente habilitado permite acesso", () => {
    expect(() => {
      assertConfiguredOrdersEntitlement(snapshot({ features: { orders: true } }));
    }).not.toThrow();
  });

  test("orders explicitamente desabilitado bloqueia", () => {
    try {
      assertConfiguredOrdersEntitlement(snapshot({ features: { orders: false } }));
      throw new Error("Esperava bloqueio");
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError);
      expect((error as EntitlementError).code).toBe("FEATURE_NOT_INCLUDED");
    }
  });

  test("assinatura suspensa bloqueia quando existe snapshot", () => {
    expect(() => {
      assertConfiguredOrdersEntitlement(snapshot({
        status: "suspended",
        features: { orders: true },
      }));
    }).toThrow();
  });
});
