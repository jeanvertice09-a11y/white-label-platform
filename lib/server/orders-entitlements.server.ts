import {
  assertFeature,
  assertSubscriptionAccess,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type { OrderScope } from "@white-label/orders";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertConfiguredOrdersEntitlement(
  snapshot: StoreSubscriptionSnapshot | null,
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (hasOwn(snapshot.features, "orders")) {
    assertFeature(snapshot, "orders");
  }
}

export async function assertOrdersEntitlement(
  sql: BillingSqlExecutor,
  scope: OrderScope,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredOrdersEntitlement(snapshot);
}
