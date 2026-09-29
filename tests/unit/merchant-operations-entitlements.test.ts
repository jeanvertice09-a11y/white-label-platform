import { describe, expect, test } from "bun:test";
import { EntitlementError } from "@white-label/billing";
import type { StoreSubscriptionSnapshot } from "@white-label/billing";
import {
  assertConfiguredMerchantOperationsEntitlements,
  resolveMerchantOperationsAccess,
} from "../../apps/web/src/lib/server/merchant-operations-entitlements.server.ts";

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

describe("merchant operations entitlements", () => {
  test("sem assinatura configurada preserva compatibilidade legada", () => {
    expect(resolveMerchantOperationsAccess(null)).toEqual({
      suppliers: true,
      purchases: true,
      finance: true,
      inventory: true,
      tasks: true,
    });
    expect(() => {
      assertConfiguredMerchantOperationsEntitlements(null, ["suppliers", "purchases"]);
    }).not.toThrow();
  });

  test("feature ausente não inventa bloqueio e feature false é respeitada", () => {
    const current = snapshot({ features: { suppliers: false, purchases: true, finance: false, inventory: true } });
    expect(resolveMerchantOperationsAccess(current)).toEqual({
      suppliers: false,
      purchases: true,
      finance: false,
      inventory: true,
      tasks: true,
    });
    expect(() => {
      assertConfiguredMerchantOperationsEntitlements(current, ["purchases", "inventory"]);
    }).not.toThrow();
    expect(() => {
      assertConfiguredMerchantOperationsEntitlements(current, ["suppliers"]);
    }).toThrow(EntitlementError);
  });

  test("compra com estoque desabilitado falha no boundary", () => {
    const current = snapshot({ features: { purchases: true, inventory: false } });
    expect(() => {
      assertConfiguredMerchantOperationsEntitlements(current, ["purchases", "inventory"]);
    }).toThrow(EntitlementError);
  });

  test("assinatura suspensa bloqueia inclusive tarefas sem feature própria", () => {
    const current = snapshot({ status: "suspended" });
    expect(() => { resolveMerchantOperationsAccess(current); }).toThrow(EntitlementError);
    expect(() => {
      assertConfiguredMerchantOperationsEntitlements(current, []);
    }).toThrow(EntitlementError);
  });
});
