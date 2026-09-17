import { describe, expect, test } from "bun:test";
import {
  addCartItem,
  cartTotalCents,
  createCart,
  removeCartItem,
  setCartItemQuantity,
} from "../../packages/catalog/src/cart.ts";
import type { Product } from "../../packages/catalog/src/types.ts";

function product(storeId = "s1"): Product {
  return {
    id: "p1",
    tenantId: "t1",
    storeId,
    name: "Produto",
    slug: "produto",
    description: null,
    sku: null,
    categoryId: null,
    priceCents: 1000,
    compareAtPriceCents: null,
    costCents: null,
    active: true,
    trackInventory: false,
    stockQuantity: 0,
    position: 0,
    images: [],
    variants: [],
  };
}

describe("catalog cart", () => {
  test("adiciona, soma, altera quantidade e remove", () => {
    let cart = createCart({ tenantId: "t1", storeId: "s1" });
    cart = addCartItem(cart, product(), null, 2);
    expect(cartTotalCents(cart)).toBe(2000);
    cart = setCartItemQuantity(cart, "p1", null, 3);
    expect(cartTotalCents(cart)).toBe(3000);
    cart = removeCartItem(cart, "p1", null);
    expect(cartTotalCents(cart)).toBe(0);
  });

  test("não aceita produto de outra store", () => {
    const cart = createCart({ tenantId: "t1", storeId: "s1" });
    expect(() => addCartItem(cart, product("s2"), null)).toThrow();
  });
});
