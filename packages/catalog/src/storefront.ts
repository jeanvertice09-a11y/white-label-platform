import type { StorefrontStore } from "./types.ts";

export class StorefrontUnavailableError extends Error {
  readonly code = "STOREFRONT_UNAVAILABLE";
}

export function isStorefrontAvailable(
  store: StorefrontStore,
  now = new Date(),
): boolean {
  if (store.storeStatus !== "active") return false;
  if (store.tenantStatus === "active") return true;
  if (store.tenantStatus !== "trial") return false;
  if (store.trialEndsAt === null) return true;
  const endsAt = Date.parse(store.trialEndsAt);
  return Number.isFinite(endsAt) && endsAt > now.getTime();
}

export function assertStorefrontAvailable(store: StorefrontStore): void {
  if (!isStorefrontAvailable(store)) {
    throw new StorefrontUnavailableError("Catálogo indisponível");
  }
}
