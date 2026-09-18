import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createCustomerRepository } from "@white-label/customers";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const nullableShort = z.string().trim().max(254).nullable();
const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(30).nullable(),
  email: nullableShort,
  document: z.string().trim().max(40).nullable(),
  birthDate: z.string().date().nullable(),
  notes: z.string().trim().max(2000).nullable(),
});
const idSchema = z.object({ id: z.string().uuid() });
const searchSchema = z.object({ search: z.string().trim().max(120).default("") });
const updateSchema = z.object({ id: z.string().uuid(), input: customerSchema });

async function repository() {
  const current = await createMerchantOperationsContext(getRequestHost());
  return {
    scope: current.scope,
    repo: createCustomerRepository(current.sql),
  };
}

export const listMerchantCustomers = createServerFn({ method: "GET" })
  .validator((data: { search?: string } | undefined) => searchSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.list(current.scope, data.search, 100);
  });

export const getMerchantCustomer = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.getById(current.scope, data.id);
  });

export const createMerchantCustomer = createServerFn({ method: "POST" })
  .validator(customerSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.create(current.scope, data);
  });

export const updateMerchantCustomer = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.update(current.scope, data.id, data.input);
  });
