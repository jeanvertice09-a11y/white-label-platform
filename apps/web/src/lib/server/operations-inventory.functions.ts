import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createInventoryRepository } from "@white-label/inventory";
import { assertInventoryEntitlement } from "./inventory-entitlements.server.ts";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const pageSchema = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
});

const historySchema = pageSchema.extend({
  movementType: z.enum([
    "initial",
    "purchase",
    "sale",
    "adjustment",
    "return",
    "cancellation",
    "manual",
  ]).optional(),
});

const operationBase = {
  operationId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  reason: z.string().trim().min(1).max(240),
};

const operationSchema = z.discriminatedUnion("kind", [
  z.object({ ...operationBase, kind: z.literal("entry"), quantity: z.number().int().min(1).max(1_000_000) }),
  z.object({ ...operationBase, kind: z.literal("exit"), quantity: z.number().int().min(1).max(1_000_000) }),
  z.object({ ...operationBase, kind: z.literal("set"), quantity: z.number().int().min(0).max(1_000_000) }),
]);

async function inventoryContext() {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertInventoryEntitlement(current.sql, current.scope);
  return current;
}

export const listMerchantInventory = createServerFn({ method: "GET" })
  .validator(pageSchema)
  .handler(async ({ data }) => {
    const current = await inventoryContext();
    return createInventoryRepository(current.sql).listPage(current.scope, data);
  });

export const listMerchantInventoryHistory = createServerFn({ method: "GET" })
  .validator(historySchema)
  .handler(async ({ data }) => {
    const current = await inventoryContext();
    return createInventoryRepository(current.sql).history(current.scope, data);
  });

export const moveMerchantInventory = createServerFn({ method: "POST" })
  .validator(operationSchema)
  .handler(async ({ data }) => {
    const current = await inventoryContext();
    return createInventoryRepository(current.sql).move(current.scope, {
      ...data,
      createdBy: current.userId,
    });
  });
