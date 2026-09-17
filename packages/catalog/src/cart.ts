import { resolvePurchasableSelection } from "./pricing.ts";
import { assertCatalogScope, assertSameCatalogScope } from "./scope.ts";
import type { CatalogScope, Product } from "./types.ts";

export interface CartItem {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
}

export interface CartState extends CatalogScope {
  items: CartItem[];
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new Error("Quantidade inválida");
  }
}

function itemKey(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? "base"}`;
}

export function createCart(scope: CatalogScope): CartState {
  assertCatalogScope(scope);
  return { ...scope, items: [] };
}

export function addCartItem(
  cart: CartState,
  product: Product,
  variantId: string | null,
  quantity = 1,
): CartState {
  assertSameCatalogScope(cart, product);
  assertQuantity(quantity);
  const selection = resolvePurchasableSelection(product, variantId);
  const key = itemKey(selection.productId, selection.variantId);
  const existing = cart.items.find((item) => itemKey(item.productId, item.variantId) === key);
  const items = existing
    ? cart.items.map((item) =>
        itemKey(item.productId, item.variantId) === key
          ? { ...item, quantity: item.quantity + quantity, unitPriceCents: selection.unitPriceCents }
          : item,
      )
    : [
        ...cart.items,
        {
          productId: selection.productId,
          variantId: selection.variantId,
          name: selection.name,
          variantName: selection.variantName,
          quantity,
          unitPriceCents: selection.unitPriceCents,
        },
      ];
  return { ...cart, items };
}

export function setCartItemQuantity(
  cart: CartState,
  productId: string,
  variantId: string | null,
  quantity: number,
): CartState {
  assertQuantity(quantity);
  const key = itemKey(productId, variantId);
  if (!cart.items.some((item) => itemKey(item.productId, item.variantId) === key)) {
    throw new Error("Item não encontrado");
  }
  return {
    ...cart,
    items: cart.items.map((item) =>
      itemKey(item.productId, item.variantId) === key ? { ...item, quantity } : item,
    ),
  };
}

export function removeCartItem(
  cart: CartState,
  productId: string,
  variantId: string | null,
): CartState {
  const key = itemKey(productId, variantId);
  return {
    ...cart,
    items: cart.items.filter((item) => itemKey(item.productId, item.variantId) !== key),
  };
}

export function cartTotalCents(cart: CartState): number {
  return cart.items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
}
