import type {
  Customer,
  CustomerDetail,
  CustomerListItem,
  CustomerOrderSummary,
} from "./types.ts";

function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Campo inválido: " + key);
}

function timestamp(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Data inválida: " + key);
}

function integer(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isSafeInteger(value)) throw new Error("Inteiro inválido: " + key);
  return value;
}

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    tenantId: requiredText(row, "tenant_id"),
    storeId: requiredText(row, "store_id"),
    id: requiredText(row, "id"),
    name: requiredText(row, "name"),
    phone: nullableText(row, "phone"),
    email: nullableText(row, "email"),
    document: nullableText(row, "document"),
    birthDate: nullableText(row, "birth_date"),
    notes: nullableText(row, "notes"),
    createdAt: timestamp(row, "created_at"),
    updatedAt: timestamp(row, "updated_at"),
  };
}

export function mapCustomerListItem(
  row: Record<string, unknown>,
): CustomerListItem {
  return {
    ...mapCustomer(row),
    totalOrders: integer(row, "total_orders"),
    totalSpentCents: integer(row, "total_spent_cents"),
    lastOrderAt: nullableText(row, "last_order_at"),
  };
}

export function mapCustomerOrder(
  row: Record<string, unknown>,
): CustomerOrderSummary {
  return {
    id: requiredText(row, "id"),
    orderNumber: integer(row, "order_number"),
    totalCents: integer(row, "total_cents"),
    status: requiredText(row, "status"),
    paymentStatus: requiredText(row, "payment_status"),
    itemCount: integer(row, "item_count"),
    itemSummary: nullableText(row, "item_summary"),
    createdAt: timestamp(row, "created_at"),
  };
}

export function withCustomerStats(
  customer: Customer,
  row: Record<string, unknown>,
  orders: CustomerOrderSummary[],
): CustomerDetail {
  return {
    ...customer,
    totalOrders: integer(row, "total_orders"),
    orderCount: integer(row, "order_count"),
    totalSpentCents: integer(row, "total_spent_cents"),
    lastOrderAt: nullableText(row, "last_order_at"),
    lastPurchaseAt: nullableText(row, "last_purchase_at"),
    orders,
  };
}
