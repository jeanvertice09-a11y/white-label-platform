import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { PostgresMerchantOperationsRepository } from "@white-label/merchant-ops";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const page = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
});

async function context() {
  const current = await createMerchantOperationsContext(getRequestHost());
  return { ...current, repo: new PostgresMerchantOperationsRepository(current.sql) };
}

export const listMerchantSuppliers = createServerFn({ method: "GET" })
  .validator(page)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.listSuppliers(current.scope, data);
  });

export const createMerchantSupplier = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().trim().min(2).max(180),
    tradeName: z.string().trim().max(180).nullable().optional(),
    document: z.string().trim().max(40).nullable().optional(),
    contactName: z.string().trim().max(180).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    whatsapp: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    address: z.string().trim().max(600).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.createSupplier(current.scope, data);
  });

export const setMerchantSupplierStatus = createServerFn({ method: "POST" })
  .validator(z.object({ supplierId: uuid, status: z.enum(["active", "inactive"]) }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.updateSupplierStatus(current.scope, data.supplierId, data.status);
  });

export const listMerchantPurchases = createServerFn({ method: "GET" })
  .validator(page)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.listPurchases(current.scope, data);
  });

export const createMerchantPurchase = createServerFn({ method: "POST" })
  .validator(z.object({
    supplierId: uuid.nullable(),
    purchasedAt: date,
    discountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    surchargeCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    notes: z.string().trim().max(4000).nullable().optional(),
    items: z.array(z.object({
      productId: uuid,
      variantId: uuid.nullable(),
      quantity: z.number().int().min(1).max(1_000_000),
      unitCostCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    })).min(1).max(100),
  }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.createPurchase(current.scope, data, current.userId);
  });

export const receiveMerchantPurchase = createServerFn({ method: "POST" })
  .validator(z.object({ purchaseId: uuid }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.receivePurchase(current.scope, data.purchaseId, current.userId);
  });

export const cancelMerchantPurchase = createServerFn({ method: "POST" })
  .validator(z.object({ purchaseId: uuid }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.cancelPurchase(current.scope, data.purchaseId, current.userId);
  });

export const listMerchantFinancialCategories = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await context();
    return current.repo.listFinancialCategories(current.scope);
  });

export const createMerchantFinancialCategory = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().trim().min(2).max(100),
    direction: z.enum(["income", "expense", "both"]),
  }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.createFinancialCategory(current.scope, data);
  });

export const listMerchantFinance = createServerFn({ method: "GET" })
  .validator(page.extend({
    direction: z.enum(["receivable", "payable"]).optional(),
    status: z.enum(["open", "settled", "cancelled"]).optional(),
    from: date.optional(),
    to: date.optional(),
  }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.listFinance(current.scope, data);
  });

export const createMerchantFinancialEntry = createServerFn({ method: "POST" })
  .validator(z.object({
    direction: z.enum(["receivable", "payable"]),
    categoryId: uuid.nullable(),
    description: z.string().trim().min(2).max(240),
    amountCents: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    dueAt: date,
    competenceDate: date,
    supplierId: uuid.nullable().optional(),
    customerId: uuid.nullable().optional(),
    orderId: uuid.nullable().optional(),
    purchaseId: uuid.nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.createFinancialEntry(current.scope, data, current.userId);
  });

export const settleMerchantFinancialEntry = createServerFn({ method: "POST" })
  .validator(z.object({ entryId: uuid }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.settleFinancialEntry(current.scope, data.entryId, new Date().toISOString());
  });

export const cancelMerchantFinancialEntry = createServerFn({ method: "POST" })
  .validator(z.object({ entryId: uuid }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.cancelFinancialEntry(current.scope, data.entryId);
  });

export const summarizeMerchantFinance = createServerFn({ method: "GET" })
  .validator(z.object({ from: date, to: date }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.summarizeFinance(current.scope, data.from, data.to);
  });

export const listMerchantTasks = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await context();
    return current.repo.listTasks(current.scope);
  });

export const createMerchantTask = createServerFn({ method: "POST" })
  .validator(z.object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(4000).nullable().optional(),
    priority: z.enum(["low", "normal", "high"]),
    dueAt: z.string().datetime().nullable().optional(),
    assigneeUserId: uuid.nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.createTask(current.scope, data, current.userId);
  });

export const completeMerchantTask = createServerFn({ method: "POST" })
  .validator(z.object({ taskId: uuid }))
  .handler(async ({ data }) => {
    const current = await context();
    return current.repo.completeTask(current.scope, data.taskId);
  });
