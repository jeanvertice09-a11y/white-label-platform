import type {
  FinancialCategory,
  FinancialEntry,
  MerchantScope,
  MerchantTask,
  Purchase,
  PurchaseItem,
  Supplier,
} from "./types.ts";

export function assertScope(scope: MerchantScope): void {
  if (!scope.tenantId || !scope.storeId) throw new Error("Escopo da loja inválido");
}

export function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo ${key} inválido`);
  return value;
}

export function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Campo ${key} inválido`);
  return value;
}

function timestampText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  throw new Error(`Campo ${key} inválido`);
}

function nullableTimestampText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  throw new Error(`Campo ${key} inválido`);
}

function dateText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  throw new Error(`Campo ${key} inválido`);
}

export function integer(row: Record<string, unknown>, key: string): number {
  const raw = row[key];
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`Campo ${key} inválido`);
  return value;
}

export function booleanValue(row: Record<string, unknown>, key: string): boolean {
  if (row[key] === true) return true;
  if (row[key] === false) return false;
  throw new Error(`Campo ${key} inválido`);
}

export function nullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function assertPage(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) throw new Error("Página inválida");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error("Tamanho de página inválido");
}

export function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    tradeName: nullableText(row, "trade_name"),
    document: nullableText(row, "document"),
    contactName: nullableText(row, "contact_name"),
    phone: nullableText(row, "phone"),
    whatsapp: nullableText(row, "whatsapp"),
    email: nullableText(row, "email"),
    address: nullableText(row, "address"),
    notes: nullableText(row, "notes"),
    status: text(row, "status") as Supplier["status"],
    createdAt: timestampText(row, "created_at"),
    updatedAt: timestampText(row, "updated_at"),
  };
}

export function mapPurchaseItem(row: Record<string, unknown>): PurchaseItem {
  return {
    id: text(row, "id"),
    productId: text(row, "product_id"),
    variantId: nullableText(row, "variant_id"),
    productName: text(row, "product_name"),
    variantName: nullableText(row, "variant_name"),
    sku: nullableText(row, "sku"),
    quantity: integer(row, "quantity"),
    unitCostCents: integer(row, "unit_cost_cents"),
    subtotalCents: integer(row, "subtotal_cents"),
  };
}

export function mapPurchase(row: Record<string, unknown>, items: PurchaseItem[]): Purchase {
  return {
    id: text(row, "id"),
    supplierId: nullableText(row, "supplier_id"),
    supplierName: nullableText(row, "supplier_name"),
    purchasedAt: dateText(row, "purchased_at"),
    status: text(row, "status") as Purchase["status"],
    subtotalCents: integer(row, "subtotal_cents"),
    discountCents: integer(row, "discount_cents"),
    surchargeCents: integer(row, "surcharge_cents"),
    totalCents: integer(row, "total_cents"),
    notes: nullableText(row, "notes"),
    receivedAt: nullableTimestampText(row, "received_at"),
    cancelledAt: nullableTimestampText(row, "cancelled_at"),
    createdAt: timestampText(row, "created_at"),
    items,
  };
}

export function mapCategory(row: Record<string, unknown>): FinancialCategory {
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    direction: text(row, "direction") as FinancialCategory["direction"],
    active: booleanValue(row, "active"),
  };
}

export function mapFinancialEntry(row: Record<string, unknown>): FinancialEntry {
  return {
    id: text(row, "id"),
    direction: text(row, "direction") as FinancialEntry["direction"],
    categoryId: nullableText(row, "category_id"),
    categoryName: nullableText(row, "category_name"),
    description: text(row, "description"),
    amountCents: integer(row, "amount_cents"),
    dueAt: dateText(row, "due_at"),
    competenceDate: dateText(row, "competence_date"),
    status: text(row, "status") as FinancialEntry["status"],
    settledAt: nullableTimestampText(row, "settled_at"),
    supplierId: nullableText(row, "supplier_id"),
    customerId: nullableText(row, "customer_id"),
    orderId: nullableText(row, "order_id"),
    purchaseId: nullableText(row, "purchase_id"),
    notes: nullableText(row, "notes"),
    createdAt: timestampText(row, "created_at"),
  };
}

export function mapTask(row: Record<string, unknown>): MerchantTask {
  return {
    id: text(row, "id"),
    title: text(row, "title"),
    description: nullableText(row, "description"),
    priority: text(row, "priority") as MerchantTask["priority"],
    status: text(row, "status") as MerchantTask["status"],
    dueAt: nullableTimestampText(row, "due_at"),
    assigneeUserId: nullableText(row, "assignee_user_id"),
    createdBy: text(row, "created_by"),
    completedAt: nullableTimestampText(row, "completed_at"),
    createdAt: timestampText(row, "created_at"),
  };
}
