import type { Order, OrderItem, OrderScope } from "./types.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new Error("Número inválido: " + key);
  return value;
}

function timestamp(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Data inválida: " + key);
}

function nullableTimestamp(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Data inválida: " + key);
}

export function mapOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    id: text(row, "id"),
    orderId: text(row, "order_id"),
    productId: nullableText(row, "product_id"),
    variantId: nullableText(row, "variant_id"),
    productName: text(row, "product_name"),
    variantName: nullableText(row, "variant_name"),
    skuSnapshot: nullableText(row, "sku_snapshot"),
    quantity: numberValue(row, "qty"),
    unitCents: numberValue(row, "unit_cents"),
    totalCents: numberValue(row, "total_cents"),
  };
}

export function mapOrder(row: Record<string, unknown>, items: OrderItem[] = []): Order {
  return {
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    id: text(row, "id"),
    orderNumber: numberValue(row, "order_number"),
    origin: text(row, "origin") as Order["origin"],
    status: text(row, "status") as Order["status"],
    paymentStatus: text(row, "payment_status") as Order["paymentStatus"],
    customerId: nullableText(row, "customer_id"),
    customerName: nullableText(row, "customer_name"),
    customerPhone: nullableText(row, "customer_phone"),
    couponId: nullableText(row, "coupon_id"),
    couponCodeSnapshot: nullableText(row, "coupon_code_snapshot"),
    notes: nullableText(row, "notes"),
    subtotalCents: numberValue(row, "subtotal_cents"),
    discountCents: numberValue(row, "discount_cents"),
    shippingCents: numberValue(row, "shipping_cents"),
    totalCents: numberValue(row, "total_cents"),
    createdAt: timestamp(row, "created_at"),
    updatedAt: timestamp(row, "updated_at"),
    confirmedAt: nullableTimestamp(row, "confirmed_at"),
    completedAt: nullableTimestamp(row, "completed_at"),
    cancelledAt: nullableTimestamp(row, "cancelled_at"),
    items,
  };
}

export function orderScopeOf(order: Order): OrderScope {
  return { tenantId: order.tenantId, storeId: order.storeId };
}
