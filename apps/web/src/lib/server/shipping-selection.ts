import type { ShippingQuote } from "./storefront-shipping.server.ts";

/** Selects a fresh provider quote and rejects an amount changed since the buyer saw it. */
export function verifyShippingSelection(
  quotes: ShippingQuote[],
  serviceId: number,
  displayedPriceCents: number,
): ShippingQuote {
  const quote = quotes.find((candidate) => candidate.serviceId === serviceId);
  if (!quote) throw new Error("Frete indisponível. Calcule novamente antes de pagar.");
  if (quote.priceCents !== displayedPriceCents) {
    throw new Error("O valor do frete mudou. Calcule novamente antes de pagar.");
  }
  return quote;
}
