import { createCart } from "./cart.ts";
import type { CartItem, CartState } from "./cart.ts";
import type { CatalogScope } from "./types.ts";

const STORAGE_VERSION = 1;

interface StoredCart {
  version: number;
  tenantId: string;
  storeId: string;
  items: unknown[];
}

function validText(value: unknown, max = 240): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function parseItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (!validText(item["productId"], 128)) return null;
  if (!(item["variantId"] === null || validText(item["variantId"], 128))) return null;
  if (!validText(item["name"])) return null;
  if (!(item["variantName"] === null || validText(item["variantName"]))) return null;
  if (!Number.isSafeInteger(item["quantity"]) || Number(item["quantity"]) < 1 || Number(item["quantity"]) > 999) return null;
  if (!Number.isSafeInteger(item["unitPriceCents"]) || Number(item["unitPriceCents"]) < 0) return null;
  return {
    productId: item["productId"],
    variantId: item["variantId"],
    name: item["name"],
    variantName: item["variantName"],
    quantity: Number(item["quantity"]),
    unitPriceCents: Number(item["unitPriceCents"]),
  };
}

export function cartStorageKey(scope: CatalogScope): string {
  return `kataluu:cart:${scope.tenantId}:${scope.storeId}`;
}

export function serializeCart(cart: CartState): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    tenantId: cart.tenantId,
    storeId: cart.storeId,
    items: cart.items,
  });
}

export function restoreCart(scope: CatalogScope, raw: string | null): CartState {
  if (!raw) return createCart(scope);
  try {
    const parsed = JSON.parse(raw) as StoredCart;
    if (
      parsed.version !== STORAGE_VERSION ||
      parsed.tenantId !== scope.tenantId ||
      parsed.storeId !== scope.storeId ||
      !Array.isArray(parsed.items)
    ) {
      return createCart(scope);
    }
    const items = parsed.items.slice(0, 100).map(parseItem).filter((item): item is CartItem => item !== null);
    return { ...scope, items };
  } catch {
    return createCart(scope);
  }
}
