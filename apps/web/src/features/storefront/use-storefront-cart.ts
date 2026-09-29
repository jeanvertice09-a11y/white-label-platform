import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { cartStorageKey, createCart, restoreCart, serializeCart } from "@white-label/catalog";
import type { CartState, CatalogScope } from "@white-label/catalog";

function normalizeQuantity(cart: CartState, quantityEnabled: boolean): CartState {
  if (quantityEnabled || cart.items.every((item) => item.quantity === 1)) return cart;
  return { ...cart, items: cart.items.map((item) => ({ ...item, quantity: 1 })) };
}

function readStored(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* carrinho continua em memória */ }
}
function removeStored(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* storage pode estar indisponível */ }
}

export function useStorefrontCart(
  scope: CatalogScope,
  enabled: boolean,
  persist: boolean,
  quantityEnabled: boolean,
): readonly [CartState, Dispatch<SetStateAction<CartState>>] {
  const [cart, setCart] = useState<CartState>(() => createCart(scope));
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const key = cartStorageKey(scope);
    if (!enabled) { removeStored(key); setCart(createCart(scope)); setHydrated(true); return; }
    if (!persist) { removeStored(key); setCart((current) => normalizeQuantity(current, quantityEnabled)); setHydrated(true); return; }
    setCart(normalizeQuantity(restoreCart(scope, readStored(key)), quantityEnabled)); setHydrated(true);
  }, [enabled, persist, quantityEnabled, scope.storeId, scope.tenantId]);
  useEffect(() => {
    if (!hydrated || !enabled || !persist) return;
    writeStored(cartStorageKey(scope), serializeCart(cart));
  }, [cart, enabled, hydrated, persist, scope.storeId, scope.tenantId]);
  return [cart, setCart] as const;
}
