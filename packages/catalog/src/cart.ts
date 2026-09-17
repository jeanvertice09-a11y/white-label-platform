import type { CatalogScope, Product } from "./types.ts";
import type { ProductVariant } from "./pricing.ts";
import {
  calculateCartLineTotal,
  resolveCatalogUnitPrice,
} from "./pricing.ts";

export interface CatalogCartLine {
  key: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  unitPriceCents: number;
  quantity: number;
}

export interface CatalogCart {
  tenantId: string;
  storeId: string;
  items: CatalogCartLine[];
}

export interface AddToCartInput {
  product: Product;
  variants: readonly ProductVariant[];
  selectedVariantId?: string | null;
  quantity?: number;
}

export function createEmptyCart(scope: CatalogScope): CatalogCart {
  return {
    tenantId: scope.tenantId,
    storeId: scope.storeId,
    items: [],
  };
}

function assertCartScope(scope: CatalogScope, cart: CatalogCart): void {
  if (cart.tenantId !== scope.tenantId || cart.storeId !== scope.storeId) {
    throw new Error("Carrinho pertence a outra loja");
  }
}

function lineKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

export function addItemToCart(
  scope: CatalogScope,
  cart: CatalogCart,
  input: AddToCartInput,
): CatalogCart {
  assertCartScope(scope, cart);

  const quantity = input.quantity ?? 1;
  const unitPriceCents = resolveCatalogUnitPrice(
    scope,
    input.product,
    input.variants,
    input.selectedVariantId,
  );
  calculateCartLineTotal(unitPriceCents, quantity);

  const selectedVariant =
    input.selectedVariantId == null
      ? null
      : input.variants.find((variant) => variant.id === input.selectedVariantId) ?? null;

  const key = lineKey(input.product.id, selectedVariant?.id ?? null);
  const existing = cart.items.find((item) => item.key === key);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  calculateCartLineTotal(unitPriceCents, nextQuantity);

  const line: CatalogCartLine = {
    key,
    productId: input.product.id,
    productSlug: input.product.slug,
    productName: input.product.name,
    variantId: selectedVariant?.id ?? null,
    variantName: selectedVariant?.name ?? null,
    unitPriceCents,
    quantity: nextQuantity,
  };

  return {
    ...cart,
    items: existing
      ? cart.items.map((item) => (item.key === key ? line : item))
      : [...cart.items, line],
  };
}

export function setCartItemQuantity(
  scope: CatalogScope,
  cart: CatalogCart,
  key: string,
  quantity: number,
): CatalogCart {
  assertCartScope(scope, cart);

  if (quantity === 0) {
    return removeCartItem(scope, cart, key);
  }

  const existing = cart.items.find((item) => item.key === key);
  if (!existing) throw new Error("Item não encontrado no carrinho");
  calculateCartLineTotal(existing.unitPriceCents, quantity);

  return {
    ...cart,
    items: cart.items.map((item) =>
      item.key === key ? { ...item, quantity } : item,
    ),
  };
}

export function removeCartItem(
  scope: CatalogScope,
  cart: CatalogCart,
  key: string,
): CatalogCart {
  assertCartScope(scope, cart);
  return {
    ...cart,
    items: cart.items.filter((item) => item.key !== key),
  };
}

export function getCartTotalCents(cart: CatalogCart): number {
  return cart.items.reduce(
    (total, item) =>
      total + calculateCartLineTotal(item.unitPriceCents, item.quantity),
    0,
  );
}

export function getCartItemCount(cart: CatalogCart): number {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}
