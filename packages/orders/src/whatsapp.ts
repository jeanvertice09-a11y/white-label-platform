import { formatOrderNumber } from "./totals.ts";
import type { Order } from "./types.ts";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw new Error("WhatsApp inválido");
  return digits;
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function buildOrderWhatsappMessage(order: Order, intro: string): string {
  const lines = [
    intro.trim() || "Olá! Quero finalizar meu pedido:",
    "",
    `Pedido ${formatOrderNumber(order.orderNumber)}`,
    "",
  ];
  for (const item of order.items) {
    const variant = item.variantName ? ` — ${item.variantName}` : "";
    lines.push(
      `${String(item.quantity)}x ${item.productName}${variant} — ${money(item.totalCents)}`,
    );
  }
  lines.push("", `Subtotal: ${money(order.subtotalCents)}`);
  if (order.discountCents > 0) {
    lines.push(`Desconto: -${money(order.discountCents)}`);
  }
  if (order.shippingCents > 0) {
    lines.push(`Frete: ${money(order.shippingCents)}`);
  }
  lines.push(`Total: ${money(order.totalCents)}`);
  return lines.join("\n");
}

export function buildOrderWhatsappUrl(
  phone: string,
  order: Order,
  intro: string,
): string {
  const normalized = normalizePhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(
    buildOrderWhatsappMessage(order, intro),
  )}`;
}
