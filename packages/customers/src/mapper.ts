import type {
  Customer,
  CustomerDetail,
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

export function mapCustomerOrder(row: Record<string, unknown>): CustomerOrderSummary {
  return {
    id: requiredText(row, "id"),
    orderNumber: Number(row["order_number"]),
    totalCents: Number(row["total_cents"]),
    status: requiredText(row, "status"),
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
    orderCount: Number(row["order_count"] ?? 0),
    totalSpentCents: Number(row["total_spent_cents"] ?? 0),
    lastPurchaseAt: nullableText(row, "last_purchase_at"),
    orders,
  };
}
