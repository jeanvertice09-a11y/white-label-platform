import type { CatalogCart } from "./cart.ts";
import { getCartTotalCents } from "./cart.ts";
import type { CatalogSettings } from "./storefront.ts";
import { isWhatsappCheckoutEnabled } from "./storefront.ts";

export interface WhatsappCheckoutInput {
  storeName: string;
  cart: CatalogCart;
  settings: CatalogSettings;
  customerName?: string;
  notes?: string;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function sanitizeLine(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/[\r\n]+/g, " ") : null;
}

export function buildWhatsappOrderMessage(input: WhatsappCheckoutInput): string {
  if (!isWhatsappCheckoutEnabled(input.settings)) {
    throw new Error("Checkout por WhatsApp desativado");
  }
  if (input.cart.items.length === 0) {
    throw new Error("Carrinho vazio");
  }

  const lines: string[] = [
    input.settings.whatsappMessageTemplate.trim(),
    "",
    `Loja: ${input.storeName.trim()}`,
  ];

  const customerName = sanitizeLine(input.customerName);
  if (customerName) lines.push(`Cliente: ${customerName}`);

  lines.push("", "Pedido:");

  for (const item of input.cart.items) {
    const variant = item.variantName ? ` — ${item.variantName}` : "";
    const lineTotal = item.unitPriceCents * item.quantity;
    lines.push(
      `• ${item.quantity}x ${item.productName}${variant} — ${formatMoney(lineTotal)}`,
    );
  }

  lines.push("", `Total: ${formatMoney(getCartTotalCents(input.cart))}`);

  const notes = sanitizeLine(input.notes);
  if (notes) {
    lines.push("", `Observações: ${notes}`);
  }

  return lines.join("\n");
}

export function buildWhatsappCheckoutUrl(input: WhatsappCheckoutInput): string {
  const phone = input.settings.whatsappPhone;
  if (!phone) throw new Error("WhatsApp da loja não configurado");
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    throw new Error("WhatsApp da loja inválido");
  }

  const message = buildWhatsappOrderMessage(input);
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}
