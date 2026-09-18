import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createCouponRepository } from "@white-label/marketing";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

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
const updateSchema = z.object({ id: z.string().uuid(), input: couponSchema });

async function repository() {
  const current = await createMerchantOperationsContext(getRequestHost());
  return {
    scope: current.scope,
    repo: createCouponRepository(current.sql),
  };
}

export const listMerchantCoupons = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await repository();
    return current.repo.list(current.scope);
  });

export const createMerchantCoupon = createServerFn({ method: "POST" })
  .validator(couponSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.create(current.scope, data);
  });

export const updateMerchantCoupon = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.update(current.scope, data.id, data.input);
  });
