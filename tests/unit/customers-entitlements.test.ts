import { describe, expect, test } from "bun:test";
import type { StoreSubscriptionSnapshot } from "@white-label/billing";
import { EntitlementError } from "@white-label/billing";
import { assertConfiguredCustomersEntitlement } from "../../apps/web/src/lib/server/customers-entitlements.server.ts";

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

describe("customers entitlements", () => {
  test("sem assinatura configurada não inventa bloqueio", () => {
    expect(() => { assertConfiguredCustomersEntitlement(null); }).not.toThrow();
  });

  test("sem regra customers configurada mantém acesso", () => {
    expect(() => { assertConfiguredCustomersEntitlement(snapshot()); }).not.toThrow();
  });

  test("customers explicitamente habilitado permite acesso", () => {
    expect(() => {
      assertConfiguredCustomersEntitlement(snapshot({
        features: { customers: true },
      }));
    }).not.toThrow();
  });

  test("customers explicitamente desabilitado bloqueia", () => {
    try {
      assertConfiguredCustomersEntitlement(snapshot({
        features: { customers: false },
      }));
      throw new Error("Esperava bloqueio");
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError);
      expect((error as EntitlementError).code).toBe("FEATURE_NOT_INCLUDED");
    }
  });

  test("assinatura suspensa bloqueia quando existe snapshot", () => {
    expect(() => {
      assertConfiguredCustomersEntitlement(snapshot({
        status: "suspended",
        features: { customers: true },
      }));
    }).toThrow();
  });
});
