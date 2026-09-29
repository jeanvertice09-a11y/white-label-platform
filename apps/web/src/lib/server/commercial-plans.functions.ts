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
    actorUserId: String(ctx.userId),
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
    const previous = await ctx.sql.query(
      `select id::text,active from public.tenant_plans
       where tenant_id=$1::uuid and template_id=$2::uuid limit 1`,
      [ctx.tenantId, data.templateId],
    );
    const planId = await saveTenantPlan(ctx.sql, ctx.tenantId, data);
    const prior = previous.at(0);
    await ctx.sql.query(
      `insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       values ($1::uuid,$2::uuid,$3,'tenant_plan',$4,$5::jsonb)`,
      [
        ctx.actorUserId,
        ctx.tenantId,
        prior ? "plan.updated" : "plan.created",
        planId,
        JSON.stringify({ active: data.active, billing_interval: data.billingInterval, price_cents: data.priceCents }),
      ],
    );
    if (prior && prior["active"] !== data.active) {
      await ctx.sql.query(
        `insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
         values ($1::uuid,$2::uuid,$3,'tenant_plan',$4,jsonb_build_object('active',$5::boolean))`,
        [ctx.actorUserId, ctx.tenantId, data.active ? "plan.activated" : "plan.deactivated", planId, data.active],
      );
    }
    return planId;
  });

export const saveControlPlanEntitlements = createServerFn({ method: "POST" })
  .validator(entitlementListSchema)
  .handler(async ({ data }) => {
    const ctx = await controlContext(true);
    await replaceTenantPlanEntitlements(ctx.sql, ctx.tenantId, data.planId, data.values);
    await ctx.sql.query(
      `insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $1::uuid,$2::uuid,'plan.entitlements_updated','tenant_plan',$3,
         jsonb_build_object('count',$4::int)
       where exists(select 1 from public.tenant_plans where tenant_id=$2::uuid and id=$3::uuid)`,
      [ctx.actorUserId, ctx.tenantId, data.planId, data.values.length],
    );
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
