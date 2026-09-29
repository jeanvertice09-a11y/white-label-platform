import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createCustomerRepository } from "@white-label/customers";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { assertCustomersEntitlement } from "./customers-entitlements.server.ts";

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
const listSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(100),
  search: z.string().trim().max(160).optional(),
});
const updateSchema = z.object({ id: z.string().uuid(), input: customerSchema });

async function repository() {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertCustomersEntitlement(current.sql, current.scope);
  return {
    scope: current.scope,
    userId: current.userId,
    repo: createCustomerRepository(current.sql),
  };
}

export const listMerchantCustomers = createServerFn({ method: "GET" })
  .validator(listSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.listPage(current.scope, data);
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
    return current.repo.create(current.scope, data, current.userId);
  });

export const updateMerchantCustomer = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const current = await repository();
    return current.repo.update(
      current.scope,
      data.id,
      data.input,
      current.userId,
    );
  });
