import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireTenantRole } from "@white-label/auth";
import {
  createStoreSubscription,
  listTenantPlanCatalog,
  replaceTenantPlanEntitlements,
  saveTenantPlan,
  updateStoreSubscriptionStatus,
} from "@white-label/billing";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadControl } from "./route-context.server.ts";

const intervalSchema = z.enum(["monthly", "quarterly", "yearly"]);
const planSchema = z.object({
  templateId: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable(),
  priceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  billingInterval: intervalSchema,
  active: z.boolean(),
  trialEnabled: z.boolean(),
  trialDays: z.number().int().min(0).max(365),
  displayOrder: z.number().int().min(0).max(10_000),
  recommended: z.boolean(),
});
const entitlementSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  kind: z.enum(["feature", "limit"]),
  enabled: z.boolean().nullable(),
  limitValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
});
const entitlementListSchema = z.object({
  planId: z.string().uuid(),
  values: z.array(entitlementSchema).max(200),
});
const subscribeSchema = z.object({
  storeId: z.string().uuid(),
  planId: z.string().uuid(),
  useTrial: z.boolean(),
});
const statusSchema = z.object({
  storeId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  status: z.enum(["trialing", "active", "past_due", "suspended", "canceled", "expired"]),
});

async function controlContext(requireAdmin: boolean) {
  const deps = await createRealDeps();
  const ctx = await loadControl({ host: getRequestHost() }, deps);
  if (requireAdmin) {
    requireTenantRole({ tenantRoles: ctx.tenantRoles }, "tenant_owner", "tenant_admin");
  }
  return {
    tenantId: String(ctx.tenantId),
    sql: createAdminSqlExecutor(),
  };
}

export const getTenantPlanCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlContext(false);
  return listTenantPlanCatalog(ctx.sql, ctx.tenantId);
});

export const saveControlPlan = createServerFn({ method: "POST" })
  .validator(planSchema)
  .handler(async ({ data }) => {
    const ctx = await controlContext(true);
    return saveTenantPlan(ctx.sql, ctx.tenantId, data);
  });

export const saveControlPlanEntitlements = createServerFn({ method: "POST" })
  .validator(entitlementListSchema)
  .handler(async ({ data }) => {
    const ctx = await controlContext(true);
    await replaceTenantPlanEntitlements(ctx.sql, ctx.tenantId, data.planId, data.values);
    return { ok: true };
  });

export const subscribeStoreToTenantPlan = createServerFn({ method: "POST" })
  .validator(subscribeSchema)
  .handler(async ({ data }) => {
    const ctx = await controlContext(true);
    return createStoreSubscription(
      ctx.sql,
      { tenantId: ctx.tenantId, storeId: data.storeId },
      data.planId,
      data.useTrial,
    );
  });

export const changeStoreSubscriptionStatus = createServerFn({ method: "POST" })
  .validator(statusSchema)
  .handler(async ({ data }) => {
    const ctx = await controlContext(true);
    await updateStoreSubscriptionStatus(
      ctx.sql,
      { tenantId: ctx.tenantId, storeId: data.storeId },
      data.subscriptionId,
      data.status,
    );
    return { ok: true };
  });
