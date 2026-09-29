import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  createCampaignRepository,
  createCouponRepository,
} from "@white-label/marketing";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import {
  assertCampaignsEntitlement,
  assertCouponsEntitlement,
} from "./marketing-entitlements.server.ts";

const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const couponSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(1).max(160),
  active: z.boolean(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  minimumOrderCents: cents.nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  usageLimit: z.number().int().min(1).nullable(),
});
const updateCouponSchema = z.object({
  id: z.string().uuid(),
  input: couponSchema,
});

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(5000),
  segmentType: z.enum(["all", "with_orders", "without_orders"]),
  scheduledAt: z.string().datetime().nullable(),
});
const campaignIdSchema = z.object({ id: z.string().uuid() });
const campaignListSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(100),
  search: z.string().trim().max(160).optional(),
});
const updateCampaignSchema = z.object({
  id: z.string().uuid(),
  input: campaignSchema,
});

async function couponRepository() {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertCouponsEntitlement(current.sql, current.scope);
  return {
    scope: current.scope,
    userId: current.userId,
    repo: createCouponRepository(current.sql),
  };
}

async function campaignRepository() {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertCampaignsEntitlement(current.sql, current.scope);
  return {
    scope: current.scope,
    userId: current.userId,
    repo: createCampaignRepository(current.sql),
  };
}

export const listMerchantCoupons = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await couponRepository();
    return current.repo.list(current.scope);
  });

export const createMerchantCoupon = createServerFn({ method: "POST" })
  .validator(couponSchema)
  .handler(async ({ data }) => {
    const current = await couponRepository();
    return current.repo.create(current.scope, data, current.userId);
  });

export const updateMerchantCoupon = createServerFn({ method: "POST" })
  .validator(updateCouponSchema)
  .handler(async ({ data }) => {
    const current = await couponRepository();
    return current.repo.update(
      current.scope,
      data.id,
      data.input,
      current.userId,
    );
  });

export const listMerchantCampaigns = createServerFn({ method: "GET" })
  .validator(campaignListSchema)
  .handler(async ({ data }) => {
    const current = await campaignRepository();
    return current.repo.listPage(current.scope, data);
  });

export const getMerchantCampaign = createServerFn({ method: "GET" })
  .validator(campaignIdSchema)
  .handler(async ({ data }) => {
    const current = await campaignRepository();
    return current.repo.getById(current.scope, data.id);
  });

export const createMerchantCampaign = createServerFn({ method: "POST" })
  .validator(campaignSchema)
  .handler(async ({ data }) => {
    const current = await campaignRepository();
    return current.repo.create(current.scope, data, current.userId);
  });

export const updateMerchantCampaign = createServerFn({ method: "POST" })
  .validator(updateCampaignSchema)
  .handler(async ({ data }) => {
    const current = await campaignRepository();
    return current.repo.update(
      current.scope,
      data.id,
      data.input,
      current.userId,
    );
  });

export const cancelMerchantCampaign = createServerFn({ method: "POST" })
  .validator(campaignIdSchema)
  .handler(async ({ data }) => {
    const current = await campaignRepository();
    return current.repo.cancel(current.scope, data.id, current.userId);
  });

export const prepareMerchantCampaign = createServerFn({ method: "POST" })
  .validator(campaignIdSchema)
  .handler(async ({ data }) => {
    const current = await campaignRepository();
    return current.repo.prepare(current.scope, data.id, current.userId);
  });
