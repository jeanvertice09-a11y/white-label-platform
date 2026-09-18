import { describe, expect, test } from "bun:test";
import type { StoreSubscriptionSnapshot } from "@white-label/billing";
import { EntitlementError } from "@white-label/billing";
import {
  assertConfiguredCampaignsEntitlement,
  assertConfiguredCouponsEntitlement,
} from "../../apps/web/src/lib/server/marketing-entitlements.server.ts";

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

function expectFeatureBlocked(run: () => void): void {
  try {
    run();
    throw new Error("Esperava bloqueio");
  } catch (error) {
    expect(error).toBeInstanceOf(EntitlementError);
    expect((error as EntitlementError).code).toBe("FEATURE_NOT_INCLUDED");
  }
}

describe("marketing entitlements", () => {
  test("sem assinatura ou regra configurada não inventa bloqueio", () => {
    expect(() => assertConfiguredCampaignsEntitlement(null)).not.toThrow();
    expect(() => assertConfiguredCouponsEntitlement(null)).not.toThrow();
    expect(() => assertConfiguredCampaignsEntitlement(snapshot())).not.toThrow();
    expect(() => assertConfiguredCouponsEntitlement(snapshot())).not.toThrow();
  });

  test("features configuradas como true permitem acesso", () => {
    expect(() => assertConfiguredCampaignsEntitlement(
      snapshot({ features: { campaigns: true } }),
    )).not.toThrow();
    expect(() => assertConfiguredCouponsEntitlement(
      snapshot({ features: { coupons: true } }),
    )).not.toThrow();
  });

  test("features configuradas como false bloqueiam", () => {
    expectFeatureBlocked(() => {
      assertConfiguredCampaignsEntitlement(
        snapshot({ features: { campaigns: false } }),
      );
    });
    expectFeatureBlocked(() => {
      assertConfiguredCouponsEntitlement(
        snapshot({ features: { coupons: false } }),
      );
    });
  });

  test("assinatura suspensa bloqueia campanhas e cupons", () => {
    expect(() => assertConfiguredCampaignsEntitlement(snapshot({
      status: "suspended",
      features: { campaigns: true },
    }))).toThrow();
    expect(() => assertConfiguredCouponsEntitlement(snapshot({
      status: "suspended",
      features: { coupons: true },
    }))).toThrow();
  });
});
