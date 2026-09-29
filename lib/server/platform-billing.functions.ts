import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { masterMutation, masterRead } from "./master-white-label.shared.server.ts";
import {
  getPlatformBillingSnapshot,
  listPlatformPlans,
} from "./platform-billing.read.server.ts";
import {
  cancelPlatformSubscription,
  createPlatformSubscription,
  expireCanceledPlatformSubscription,
} from "./platform-billing.subscription.server.ts";
import { createPlatformCharge } from "./platform-billing.charge.server.ts";
import {
  createPlatformProviderLoader,
  platformBillingWritesEnabled,
} from "./platform-billing.provider.server.ts";

const tenantSchema = z.object({ tenantId: z.string().uuid() }).strict();
const subscriptionSchema = z.object({ subscriptionId: z.string().uuid() }).strict();
const createSubscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
}).strict();

export const getMasterPlatformBilling = createServerFn({ method: "GET" })
  .validator(tenantSchema)
  .handler(async ({ data }) => {
    const context = await masterRead();
    return getPlatformBillingSnapshot(context.sql, data.tenantId);
  });

export const listMasterPlatformPlans = createServerFn({ method: "GET" })
  .handler(async () => listPlatformPlans((await masterRead()).sql));

export const createMasterPlatformSubscription = createServerFn({ method: "POST" })
  .validator(createSubscriptionSchema)
  .handler(async ({ data }) => {
    const context = await masterMutation();
    return createPlatformSubscription(
      context.sql,
      context.actorUserId,
      data.tenantId,
      data.planId,
    );
  });

export const cancelMasterPlatformSubscription = createServerFn({ method: "POST" })
  .validator(subscriptionSchema)
  .handler(async ({ data }) => {
    const context = await masterMutation();
    await cancelPlatformSubscription(context.sql, context.actorUserId, data.subscriptionId);
    return { ok: true };
  });

export const expireMasterPlatformSubscription = createServerFn({ method: "POST" })
  .validator(subscriptionSchema)
  .handler(async ({ data }) => {
    const context = await masterMutation();
    const expired = await expireCanceledPlatformSubscription(
      context.sql,
      context.actorUserId,
      data.subscriptionId,
    );
    return { expired };
  });

export const createMasterPlatformCharge = createServerFn({ method: "POST" })
  .validator(subscriptionSchema)
  .handler(async ({ data }) => {
    if (!platformBillingWritesEnabled()) {
      throw new Error("Cobrança sandbox desabilitada neste ambiente.");
    }
    const context = await masterMutation();
    return createPlatformCharge(
      context.sql,
      context.actorUserId,
      data.subscriptionId,
      createPlatformProviderLoader(context.sql),
    );
  });
