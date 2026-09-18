import {
  assertFeature,
  assertSubscriptionAccess,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type { InventoryScope } from "@white-label/inventory";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertConfiguredInventoryEntitlement(
  snapshot: StoreSubscriptionSnapshot | null,
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (hasOwn(snapshot.features, "inventory")) {
    assertFeature(snapshot, "inventory");
  }
}

export async function assertInventoryEntitlement(
  sql: BillingSqlExecutor,
  scope: InventoryScope,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredInventoryEntitlement(snapshot);
}
