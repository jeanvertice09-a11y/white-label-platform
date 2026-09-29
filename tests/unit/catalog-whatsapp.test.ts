import { describe, expect, test } from "bun:test";
import { buildWhatsappCheckoutUrl, buildWhatsappMessage } from "../../packages/catalog/src/whatsapp.ts";
import type { CartState } from "../../packages/catalog/src/cart.ts";

const cart: CartState = {
  tenantId: "t1",
  storeId: "s1",
  items: [{
    productId: "p1",
    variantId: "v1",
    name: "Camiseta",
    variantName: "P",
    quantity: 2,
    unitPriceCents: 1299,
  }],
};

describe("whatsapp checkout", () => {
  test("mensagem contém variante, quantidade e total", () => {
    const message = buildWhatsappMessage(cart, "Pedido:");
    expect(message).toContain("2x Camiseta — P");
    expect(message).toContain("R$");
    expect(message).toContain("25,98");
  });

  test("gera URL wa.me com telefone normalizado", () => {
    const url = buildWhatsappCheckoutUrl("+55 (62) 99999-0000", cart, "Pedido:");
    expect(url.startsWith("https://wa.me/5562999990000?text=")).toBe(true);
  });

  test("carrinho vazio não finaliza", () => {
    expect(() => buildWhatsappMessage({ ...cart, items: [] }, "Pedido:")).toThrow();
  });
});
