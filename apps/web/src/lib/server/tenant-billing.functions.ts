import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { controlMerchantMutation, controlMerchantRead } from "./control-merchants.shared.server.ts";
import { createTenantMerchantCharge } from "./tenant-billing.charge.server.ts";
import { createTenantProviderLoader } from "./tenant-billing.provider.server.ts";
import { loadTenantBillingWorkspace } from "./tenant-billing.read.server.ts";
import { reconcileTenantMerchantPayment } from "./tenant-billing.reconcile.server.ts";

const statusSchema = z.enum([
  "all", "trialing", "active", "past_due", "suspended", "canceled", "expired",
]);
const searchSchema = z.object({
  query: z.string().trim().max(120),
  status: statusSchema,
  page: z.number().int().min(1).max(100_000),
  pageSize: z.number().int().min(1).max(50),
});
const chargeSchema = z.object({
  storeId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
});
const reconcileSchema = z.object({
  storeId: z.string().uuid(),
  paymentId: z.string().uuid(),
});

export const getControlTenantBillingWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlMerchantRead();
  return loadTenantBillingWorkspace(ctx.sql, ctx.tenantId);
});

export const searchControlTenantBilling = createServerFn({ method: "POST" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantRead();
    return loadTenantBillingWorkspace(ctx.sql, ctx.tenantId, data);
  });

export const createControlTenantCharge = createServerFn({ method: "POST" })
  .validator(chargeSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return createTenantMerchantCharge(
      ctx.sql,
      ctx.actorUserId,
      ctx.tenantId,
      data.storeId,
      data.subscriptionId,
      createTenantProviderLoader(ctx.sql),
    );
  });

export const reconcileControlTenantPayment = createServerFn({ method: "POST" })
  .validator(reconcileSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return reconcileTenantMerchantPayment(
      ctx.sql,
      ctx.tenantId,
      data.storeId,
      data.paymentId,
      createTenantProviderLoader(ctx.sql),
    );
  });
