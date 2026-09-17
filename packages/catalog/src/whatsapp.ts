import { cartTotalCents } from "./cart.ts";
import type { CartState } from "./cart.ts";

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

export function buildWhatsappMessage(cart: CartState, intro: string): string {
  if (cart.items.length === 0) throw new Error("Carrinho vazio");
  const lines = [intro.trim() || "Olá! Quero finalizar meu pedido:", ""];
  for (const item of cart.items) {
    const variant = item.variantName ? ` — ${item.variantName}` : "";
    lines.push(
      `${item.quantity}x ${item.name}${variant} — ${money(item.unitPriceCents * item.quantity)}`,
    );
  }
  lines.push("", `Total: ${money(cartTotalCents(cart))}`);
  return lines.join("\n");
}

export function buildWhatsappCheckoutUrl(
  phone: string,
  cart: CartState,
  intro: string,
): string {
  const normalized = normalizePhone(phone);
  const message = buildWhatsappMessage(cart, intro);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
