import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { PostgresMerchantOperationsRepository } from "../../../../../packages/merchant-ops/src/index.ts";
import { assertMerchantOperationsEntitlements, loadMerchantOperationsAccess } from "./merchant-operations-entitlements.server.ts";
import type { MerchantOperationsFeature } from "./merchant-operations-entitlements.server.ts";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const page = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
});
const supplier = z.object({
  name: z.string().trim().min(2).max(180),
  tradeName: z.string().trim().max(180).nullable().optional(),
  document: z.string().trim().max(40).nullable().optional(),
  contactName: z.string().trim().max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  whatsapp: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  address: z.string().trim().max(600).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const task = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(4000).nullable().optional(),
  priority: z.enum(["low", "normal", "high"]),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeUserId: uuid.nullable().optional(),
});

async function context(features: readonly MerchantOperationsFeature[] = []) {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertMerchantOperationsEntitlements(current.sql, current.scope, features);
  return { ...current, repo: new PostgresMerchantOperationsRepository(current.sql) };
}

interface AuditContext {
  sql: { query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> };
  scope: { tenantId: string; storeId: string };
  userId: string;
}

async function auditOperation(
  current: AuditContext,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await current.sql.query(
    `insert into public.audit_logs
      (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb) returning id`,
    [current.userId, current.scope.tenantId, current.scope.storeId, action, resourceType, resourceId, JSON.stringify(metadata)],
  );
}

export interface MerchantTaskAssigneeOption { userId: string; role: string; }

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Membership inválida");
  return value;
}

async function assertTaskAssignee(
  sql: { query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> },
  scope: { tenantId: string; storeId: string },
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  const rows = await sql.query(
    `select user_id from public.store_members
     where tenant_id=$1::uuid and store_id=$2::uuid and user_id=$3::uuid limit 1`,
    [scope.tenantId, scope.storeId, userId],
  );
  if (!rows[0]) throw new Error("Responsável não pertence à equipe desta loja");
}

export const getMerchantOperationsAccess = createServerFn({ method: "GET" }).handler(async () => {
  const current = await createMerchantOperationsContext(getRequestHost());
  return loadMerchantOperationsAccess(current.sql, current.scope);
});

export const listMerchantSuppliers = createServerFn({ method: "GET" }).validator(page).handler(async ({ data }) => {
  const current = await context(["suppliers"]);
  return current.repo.listSuppliers(current.scope, data);
});
export const createMerchantSupplier = createServerFn({ method: "POST" }).validator(supplier).handler(async ({ data }) => {
  const current = await context(["suppliers"]);
  const result = await current.repo.createSupplier(current.scope, data);
  await auditOperation(current, "supplier.created", "merchant_supplier", result.id, { status: result.status });
  return result;
});
export const updateMerchantSupplier = createServerFn({ method: "POST" }).validator(z.object({ supplierId: uuid, input: supplier })).handler(async ({ data }) => {
  const current = await context(["suppliers"]);
  const result = await current.repo.updateSupplier(current.scope, data.supplierId, data.input);
  await auditOperation(current, "supplier.updated", "merchant_supplier", result.id);
  return result;
});
export const setMerchantSupplierStatus = createServerFn({ method: "POST" }).validator(z.object({ supplierId: uuid, status: z.enum(["active", "inactive"]) })).handler(async ({ data }) => {
  const current = await context(["suppliers"]);
  const result = await current.repo.updateSupplierStatus(current.scope, data.supplierId, data.status);
  await auditOperation(current, "supplier.status_changed", "merchant_supplier", result.id, { status: result.status });
  return result;
});

export const listMerchantPurchases = createServerFn({ method: "GET" }).validator(page).handler(async ({ data }) => {
  const current = await context(["purchases"]);
  return current.repo.listPurchases(current.scope, data);
});
export const createMerchantPurchase = createServerFn({ method: "POST" }).validator(z.object({
  supplierId: uuid.nullable(), purchasedAt: date,
  discountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  surchargeCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  notes: z.string().trim().max(4000).nullable().optional(),
  items: z.array(z.object({ productId: uuid, variantId: uuid.nullable(), quantity: z.number().int().min(1).max(1_000_000), unitCostCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })).min(1).max(100),
})).handler(async ({ data }) => {
  const features: MerchantOperationsFeature[] = ["purchases", "inventory"];
  if (data.supplierId) features.push("suppliers");
  const current = await context(features);
  const result = await current.repo.createPurchase(current.scope, data, current.userId);
  await auditOperation(current, "purchase.created", "merchant_purchase", result.id, { item_count: result.items.length, status: result.status });
  return result;
});
export const receiveMerchantPurchase = createServerFn({ method: "POST" }).validator(z.object({ purchaseId: uuid })).handler(async ({ data }) => {
  const current = await context(["purchases", "inventory"]);
  const result = await current.repo.receivePurchase(current.scope, data.purchaseId, current.userId);
  await auditOperation(current, "purchase.received", "merchant_purchase", result.id, { item_count: result.items.length, status: result.status });
  return result;
});
export const cancelMerchantPurchase = createServerFn({ method: "POST" }).validator(z.object({ purchaseId: uuid })).handler(async ({ data }) => {
  const current = await context(["purchases"]);
  const result = await current.repo.cancelPurchase(current.scope, data.purchaseId, current.userId);
  await auditOperation(current, "purchase.cancelled", "merchant_purchase", result.id, { status: result.status });
  return result;
});

export const listMerchantFinancialCategories = createServerFn({ method: "GET" }).handler(async () => {
  const current = await context(["finance"]);
  return current.repo.listFinancialCategories(current.scope);
});
export const createMerchantFinancialCategory = createServerFn({ method: "POST" }).validator(z.object({ name: z.string().trim().min(2).max(100), direction: z.enum(["income", "expense", "both"]) })).handler(async ({ data }) => {
  const current = await context(["finance"]);
  const result = await current.repo.createFinancialCategory(current.scope, data);
  await auditOperation(current, "finance.category_created", "merchant_financial_category", result.id, { direction: result.direction });
  return result;
});
export const updateMerchantFinancialCategory = createServerFn({ method: "POST" }).validator(z.object({
  categoryId: uuid,
  name: z.string().trim().min(2).max(100),
  direction: z.enum(["income", "expense", "both"]),
  active: z.boolean(),
})).handler(async ({ data }) => {
  const current = await context(["finance"]);
  const result = await current.repo.updateFinancialCategory(
    current.scope,
    data.categoryId,
    { name: data.name, direction: data.direction },
    data.active,
  );
  await auditOperation(current, "finance.category_updated", "merchant_financial_category", result.id, { direction: result.direction, active: result.active });
  return result;
});
export const listMerchantFinance = createServerFn({ method: "GET" }).validator(page.extend({
  direction: z.enum(["receivable", "payable"]).optional(), status: z.enum(["open", "settled", "cancelled"]).optional(), from: date.optional(), to: date.optional(),
})).handler(async ({ data }) => {
  const current = await context(["finance"]);
  return current.repo.listFinance(current.scope, data);
});
export const createMerchantFinancialEntry = createServerFn({ method: "POST" }).validator(z.object({
  direction: z.enum(["receivable", "payable"]), categoryId: uuid.nullable(), description: z.string().trim().min(2).max(240),
  amountCents: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), dueAt: date, competenceDate: date,
  supplierId: uuid.nullable().optional(), customerId: uuid.nullable().optional(), orderId: uuid.nullable().optional(), purchaseId: uuid.nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})).handler(async ({ data }) => {
  const features: MerchantOperationsFeature[] = ["finance"];
  if (data.supplierId) features.push("suppliers");
  if (data.purchaseId) features.push("purchases");
  if (data.customerId) features.push("customers");
  if (data.orderId) features.push("orders");
  const current = await context(features);
  const result = await current.repo.createFinancialEntry(current.scope, data, current.userId);
  await auditOperation(current, "finance.entry_created", "merchant_financial_entry", result.id, { direction: result.direction, status: result.status });
  return result;
});
export const settleMerchantFinancialEntry = createServerFn({ method: "POST" }).validator(z.object({ entryId: uuid })).handler(async ({ data }) => {
  const current = await context(["finance"]);
  const result = await current.repo.settleFinancialEntry(current.scope, data.entryId, new Date().toISOString());
  await auditOperation(current, "finance.entry_settled", "merchant_financial_entry", result.id, { direction: result.direction, status: result.status });
  return result;
});
export const cancelMerchantFinancialEntry = createServerFn({ method: "POST" }).validator(z.object({ entryId: uuid })).handler(async ({ data }) => {
  const current = await context(["finance"]);
  const result = await current.repo.cancelFinancialEntry(current.scope, data.entryId);
  await auditOperation(current, "finance.entry_cancelled", "merchant_financial_entry", result.id, { direction: result.direction, status: result.status });
  return result;
});
export const summarizeMerchantFinance = createServerFn({ method: "GET" }).validator(z.object({ from: date, to: date })).handler(async ({ data }) => {
  const current = await context(["finance"]);
  return current.repo.summarizeFinance(current.scope, data.from, data.to);
});

export const listMerchantTasks = createServerFn({ method: "GET" }).handler(async () => {
  const current = await context();
  return current.repo.listTasks(current.scope);
});
export const listMerchantTaskAssignees = createServerFn({ method: "GET" }).handler(async (): Promise<MerchantTaskAssigneeOption[]> => {
  const current = await context();
  const rows = await current.sql.query(
    `select user_id,role from public.store_members where tenant_id=$1::uuid and store_id=$2::uuid order by role,user_id`,
    [current.scope.tenantId, current.scope.storeId],
  );
  return rows.map((row) => ({ userId: text(row, "user_id"), role: text(row, "role") }));
});
export const createMerchantTask = createServerFn({ method: "POST" }).validator(task).handler(async ({ data }) => {
  const current = await context();
  await assertTaskAssignee(current.sql, current.scope, data.assigneeUserId);
  const result = await current.repo.createTask(current.scope, data, current.userId);
  await auditOperation(current, "task.created", "merchant_task", result.id, { priority: result.priority, assigned: Boolean(result.assigneeUserId) });
  return result;
});
export const updateMerchantTask = createServerFn({ method: "POST" }).validator(z.object({ taskId: uuid, input: task })).handler(async ({ data }) => {
  const current = await context();
  await assertTaskAssignee(current.sql, current.scope, data.input.assigneeUserId);
  const result = await current.repo.updateTask(current.scope, data.taskId, data.input);
  await auditOperation(current, "task.updated", "merchant_task", result.id, { priority: result.priority, assigned: Boolean(result.assigneeUserId) });
  return result;
});
export const setMerchantTaskStatus = createServerFn({ method: "POST" }).validator(z.object({ taskId: uuid, status: z.enum(["open", "done"]) })).handler(async ({ data }) => {
  const current = await context();
  const result = await current.repo.setTaskStatus(current.scope, data.taskId, data.status);
  await auditOperation(current, "task.status_changed", "merchant_task", result.id, { status: result.status });
  return result;
});
export const completeMerchantTask = createServerFn({ method: "POST" }).validator(z.object({ taskId: uuid })).handler(async ({ data }) => {
  const current = await context();
  const result = await current.repo.completeTask(current.scope, data.taskId);
  await auditOperation(current, "task.status_changed", "merchant_task", result.id, { status: result.status });
  return result;
});
