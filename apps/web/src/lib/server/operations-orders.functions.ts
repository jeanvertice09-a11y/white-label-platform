import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createOrderRepository } from "@white-label/orders";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { assertOrdersEntitlement } from "./orders-entitlements.server.ts";

const idSchema = z.object({ id: z.string().uuid() });
const advanceSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["preparing", "ready", "completed"]),
});
const listSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(100),
  search: z.string().trim().max(160).optional(),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

async function context() {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertOrdersEntitlement(current.sql, current.scope);
  return {
    scope: current.scope,
    userId: current.userId,
    repository: createOrderRepository(current.sql),
  };
}

export const listMerchantOrders = createServerFn({ method: "GET" })
  .validator(listSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.listPage(current.scope, data);
  });

export const getMerchantOrder = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.getById(current.scope, data.id);
  });

export const getMerchantOrderDetail = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    const order = await current.repository.getById(current.scope, data.id);
    if (!order) return null;
    const timeline = await current.repository.getTimeline(current.scope, data.id);
    return { order, timeline };
  });

export const confirmMerchantOrder = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.confirm(current.scope, data.id, current.userId);
  });

export const cancelMerchantOrder = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.cancel(current.scope, data.id, current.userId);
  });

export const advanceMerchantOrder = createServerFn({ method: "POST" })
  .validator(advanceSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.advance(
      current.scope,
      data.id,
      data.status,
      current.userId,
    );
  });
