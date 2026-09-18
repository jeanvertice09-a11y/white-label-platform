import { describe, expect, test } from "bun:test";
import {
  addCartItem,
  cartTotalCents,
  clearCart,
  createCart,
  setCartItemQuantity,
} from "../../packages/catalog/src/index.ts";
import type { Product } from "../../packages/catalog/src/index.ts";

const scope = {
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

const product: Product = {
  ...scope,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Produto",
  slug: "produto",
  description: null,
  sku: "SKU",
  categoryId: null,
  priceCents: 1299,
  compareAtPriceCents: null,
  costCents: null,
  active: true,
  trackInventory: false,
  stockQuantity: 0,
  position: 0,
  variants: [],
  images: [],
};

describe("fase 10 carrinho público", () => {
  test("adiciona, altera quantidade, calcula subtotal e limpa", () => {
    const cart = addCartItem(createCart(scope), product, null, 2);
    expect(cartTotalCents(cart)).toBe(2598);
    const changed = setCartItemQuantity(cart, product.id, null, 3);
    expect(cartTotalCents(changed)).toBe(3897);
    expect(clearCart(changed).items).toHaveLength(0);
  });

  test("não permite ultrapassar o limite central ao somar o mesmo item", () => {
    const cart = addCartItem(createCart(scope), product, null, 999);
    expect(() => addCartItem(cart, product, null, 1)).toThrow("Quantidade inválida");
  });
});
