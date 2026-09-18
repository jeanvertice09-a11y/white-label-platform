import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  controlMerchantMutation,
  controlMerchantRead,
} from "./control-merchants.shared.server.ts";
import {
  getControlMerchantDetail,
  listControlMerchants,
  loadControlMerchantWorkspace,
} from "./control-merchants.read.server.ts";
import {
  changeControlMerchantOwner,
  createControlMerchant,
  setControlMerchantStatus,
  updateControlMerchant,
} from "./control-merchants.write.server.ts";
import {
  assignControlMerchantPlan,
  setControlSubscriptionStatus,
} from "./control-merchants.billing.server.ts";

const storeStatusSchema = z.enum(["draft", "active", "suspended"]);
const listSchema = z.object({
  query: z.string().trim().max(120),
  status: z.union([z.literal("all"), storeStatusSchema]),
  page: z.number().int().min(1).max(100_000),
  pageSize: z.number().int().min(1).max(50),
});
const storeIdSchema = z.object({ storeId: z.string().uuid() });
const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
  ownerEmail: z.string().trim().email().max(320),
  planId: z.string().uuid().nullable(),
  useTrial: z.boolean(),
});
const updateSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
});
const ownerSchema = z.object({
  storeId: z.string().uuid(),
  ownerEmail: z.string().trim().email().max(320),
});
const statusSchema = z.object({
  storeId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});
const planSchema = z.object({
  storeId: z.string().uuid(),
  planId: z.string().uuid(),
  useTrial: z.boolean(),
});
const subscriptionStatusSchema = z.object({
  storeId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  status: z.enum(["active", "past_due", "suspended", "canceled", "expired"]),
});

export const getControlMerchantWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlMerchantRead();
  return loadControlMerchantWorkspace(ctx.sql, ctx.tenantId);
});

export const searchControlMerchants = createServerFn({ method: "POST" })
  .validator(listSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantRead();
    return listControlMerchants(ctx.sql, ctx.tenantId, data);
  });

export const getControlMerchant = createServerFn({ method: "POST" })
  .validator(storeIdSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantRead();
    return getControlMerchantDetail(ctx.sql, ctx.tenantId, data.storeId);
  });

export const createControlMerchantAction = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    if (data.useTrial && !data.planId) throw new Error("Trial exige um plano.");
    const ctx = await controlMerchantMutation();
    return createControlMerchant(ctx.sql, ctx.tenantId, ctx.actorUserId, data);
  });

export const updateControlMerchantAction = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return updateControlMerchant(ctx.sql, ctx.tenantId, ctx.actorUserId, data);
  });

export const changeControlMerchantOwnerAction = createServerFn({ method: "POST" })
  .validator(ownerSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return changeControlMerchantOwner(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.storeId,
      data.ownerEmail,
    );
  });

export const setControlMerchantStatusAction = createServerFn({ method: "POST" })
  .validator(statusSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return setControlMerchantStatus(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.storeId,
      data.status,
    );
  });

export const assignControlMerchantPlanAction = createServerFn({ method: "POST" })
  .validator(planSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return assignControlMerchantPlan(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.storeId,
      data.planId,
      data.useTrial,
    );
  });

export const setControlSubscriptionStatusAction = createServerFn({ method: "POST" })
  .validator(subscriptionStatusSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return setControlSubscriptionStatus(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.storeId,
      data.subscriptionId,
      data.status,
    );
  });
