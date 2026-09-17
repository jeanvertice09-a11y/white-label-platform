import type { StorefrontStore } from "./types.ts";

export class StorefrontUnavailableError extends Error {
  readonly code = "STOREFRONT_UNAVAILABLE";
}

export function isStorefrontAvailable(store: StorefrontStore): boolean {
  const tenantAllowed = store.tenantStatus === "active" || store.tenantStatus === "trial";
  return tenantAllowed && store.storeStatus === "active";
}

export function assertStorefrontAvailable(store: StorefrontStore): void {
  if (!isStorefrontAvailable(store)) {
    throw new StorefrontUnavailableError("Catálogo indisponível");
  }
}
