import { describe, expect, test } from "bun:test";
import { evaluatePlatformAccess } from "../../packages/billing/src/platform-access.ts";
import { platformBillingWritesEnabled } from "../../apps/web/src/lib/server/platform-billing.provider.server.ts";

const NOW = new Date("2026-09-18T18:00:00Z");

describe("fase 13 platform_billing access e fail-closed", () => {
  test("trial válido libera acesso sem exigir pagamento", () => {
    expect(evaluatePlatformAccess({
      tenantStatus: "trial",
      tenantTrialEndsAt: "2026-09-20T18:00:00Z",
      subscriptionStatus: null,
      subscriptionTrialEndsAt: null,
    }, NOW)).toEqual({ allowed: true, source: "tenant_trial" });
  });

  test("trial expirado ou sem data válida falha fechado", () => {
    expect(evaluatePlatformAccess({
      tenantStatus: "trial",
      tenantTrialEndsAt: "2026-09-17T18:00:00Z",
      subscriptionStatus: null,
      subscriptionTrialEndsAt: null,
    }, NOW)).toEqual({ allowed: false, reason: "TRIAL_EXPIRED" });
    expect(evaluatePlatformAccess({
      tenantStatus: "trial",
      tenantTrialEndsAt: null,
      subscriptionStatus: null,
      subscriptionTrialEndsAt: null,
    }, NOW)).toEqual({ allowed: false, reason: "TRIAL_EXPIRED" });
  });

  test("assinatura ativa libera; past_due/canceled/expired bloqueiam", () => {
    expect(evaluatePlatformAccess({
      tenantStatus: "active",
      tenantTrialEndsAt: null,
      subscriptionStatus: "active",
      subscriptionTrialEndsAt: null,
    }, NOW)).toEqual({ allowed: true, source: "subscription" });
    for (const [status, reason] of [
      ["past_due", "SUBSCRIPTION_PAST_DUE"],
      ["canceled", "SUBSCRIPTION_CANCELED"],
      ["expired", "SUBSCRIPTION_EXPIRED"],
    ] as const) {
      expect(evaluatePlatformAccess({
        tenantStatus: "active",
        tenantTrialEndsAt: null,
        subscriptionStatus: status,
        subscriptionTrialEndsAt: null,
      }, NOW)).toEqual({ allowed: false, reason });
    }
  });

  test("tenant suspenso permanece uma dimensão separada e vence billing ativo", () => {
    expect(evaluatePlatformAccess({
      tenantStatus: "suspended",
      tenantTrialEndsAt: null,
      subscriptionStatus: "active",
      subscriptionTrialEndsAt: null,
    }, NOW)).toEqual({ allowed: false, reason: "TENANT_SUSPENDED" });
  });

  test("assinatura ausente em tenant ativo falha fechado", () => {
    expect(evaluatePlatformAccess({
      tenantStatus: "active",
      tenantTrialEndsAt: null,
      subscriptionStatus: null,
      subscriptionTrialEndsAt: null,
    }, NOW)).toEqual({ allowed: false, reason: "SUBSCRIPTION_MISSING" });
  });

  test("writes só habilitam explicitamente em sandbox e nunca em produção", () => {
    expect(platformBillingWritesEnabled({
      APP_ENV: "local",
      NODE_ENV: "development",
      PLATFORM_BILLING_SANDBOX_WRITES: "YES",
    })).toBe(true);
    expect(platformBillingWritesEnabled({
      APP_ENV: "production",
      NODE_ENV: "production",
      PLATFORM_BILLING_SANDBOX_WRITES: "YES",
    })).toBe(false);
    expect(platformBillingWritesEnabled({
      APP_ENV: "local",
      NODE_ENV: "development",
      PLATFORM_BILLING_SANDBOX_WRITES: "true",
    })).toBe(false);
  });
});
