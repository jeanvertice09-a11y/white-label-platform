import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createOrderRepository } from "@white-label/orders";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const idSchema = z.object({ id: z.string().uuid() });
const advanceSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["preparing", "ready", "completed"]),
});

async function context() {
  const current = await createMerchantOperationsContext(getRequestHost());
  return {
    scope: current.scope,
    repository: createOrderRepository(current.sql),
  };
}

export const listMerchantOrders = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await context();
    return current.repository.list(current.scope, 100);
  });

export const getMerchantOrder = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.getById(current.scope, data.id);
  });

export const confirmMerchantOrder = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.confirm(current.scope, data.id);
  });

export const cancelMerchantOrder = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.cancel(current.scope, data.id);
  });

export const advanceMerchantOrder = createServerFn({ method: "POST" })
  .validator(advanceSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.advance(current.scope, data.id, data.status);
  });
