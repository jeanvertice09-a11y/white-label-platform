import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createInventoryRepository } from "@white-label/inventory";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  type: z.enum(["initial", "purchase", "adjustment", "return", "manual"]),
  reason: z.string().trim().min(1).max(240),
});

export const listMerchantInventory = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await createMerchantOperationsContext(getRequestHost());
    return createInventoryRepository(current.sql).list(current.scope);
  });

export const adjustMerchantInventory = createServerFn({ method: "POST" })
  .validator(adjustmentSchema)
  .handler(async ({ data }) => {
    const current = await createMerchantOperationsContext(getRequestHost());
    return createInventoryRepository(current.sql).adjust(current.scope, {
      ...data,
      createdBy: current.userId,
    });
  });
