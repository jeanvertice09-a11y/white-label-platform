import type { OrderItem } from "./types.ts";

export function calculateOrderTotals(
  items: Pick<OrderItem, "quantity" | "unitCents">[],
  discountCents = 0,
  shippingCents = 0,
): { subtotalCents: number; discountCents: number; shippingCents: number; totalCents: number } {
  if (!Number.isInteger(discountCents) || discountCents < 0) {
    throw new Error("Desconto inválido");
  }
  if (!Number.isInteger(shippingCents) || shippingCents < 0) {
    throw new Error("Frete inválido");
  }
  const subtotalCents = items.reduce((total, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("Quantidade inválida");
    if (!Number.isInteger(item.unitCents) || item.unitCents < 0) throw new Error("Preço inválido");
    return total + item.quantity * item.unitCents;
  }, 0);
  const appliedDiscount = Math.min(discountCents, subtotalCents);
  return {
    subtotalCents,
    discountCents: appliedDiscount,
    shippingCents,
    totalCents: subtotalCents - appliedDiscount + shippingCents,
  };
}

export function formatOrderNumber(orderNumber: number): string {
  if (!Number.isInteger(orderNumber) || orderNumber < 1) throw new Error("Número de pedido inválido");
  return "#" + String(orderNumber).padStart(8, "0");
}
