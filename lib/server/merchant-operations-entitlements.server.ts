import {
  assertFeature,
  assertSubscriptionAccess,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type { MerchantScope } from "../../../../../packages/merchant-ops/src/types.ts";

export type MerchantOperationsFeature =
  | "suppliers"
  | "purchases"
  | "finance"
  | "inventory"
  | "customers"
  | "orders";

export interface MerchantOperationsAccess {
  suppliers: boolean;
  purchases: boolean;
  finance: boolean;
  inventory: boolean;
  tasks: boolean;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function configuredFeature(
  snapshot: StoreSubscriptionSnapshot,
  feature: MerchantOperationsFeature,
): boolean {
  return !hasOwn(snapshot.features, feature) || snapshot.features[feature];
}

export function resolveMerchantOperationsAccess(
  snapshot: StoreSubscriptionSnapshot | null,
): MerchantOperationsAccess {
  if (!snapshot) {
    return { suppliers: true, purchases: true, finance: true, inventory: true, tasks: true };
  }
  assertSubscriptionAccess(snapshot);
  return {
    suppliers: configuredFeature(snapshot, "suppliers"),
    purchases: configuredFeature(snapshot, "purchases"),
    finance: configuredFeature(snapshot, "finance"),
    inventory: configuredFeature(snapshot, "inventory"),
    tasks: true,
  };
}

export function assertConfiguredMerchantOperationsEntitlements(
  snapshot: StoreSubscriptionSnapshot | null,
  features: readonly MerchantOperationsFeature[],
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  for (const feature of features) {
    if (hasOwn(snapshot.features, feature)) assertFeature(snapshot, feature);
  }
}

export async function loadMerchantOperationsAccess(
  sql: BillingSqlExecutor,
  scope: MerchantScope,
): Promise<MerchantOperationsAccess> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  return resolveMerchantOperationsAccess(snapshot);
}

export async function assertMerchantOperationsEntitlements(
  sql: BillingSqlExecutor,
  scope: MerchantScope,
  features: readonly MerchantOperationsFeature[],
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredMerchantOperationsEntitlements(snapshot, features);
}
