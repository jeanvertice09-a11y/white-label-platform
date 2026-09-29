import {
  assertFeature,
  assertSubscriptionAccess,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type { CustomerScope } from "@white-label/customers";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertConfiguredCustomersEntitlement(
  snapshot: StoreSubscriptionSnapshot | null,
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (hasOwn(snapshot.features, "customers")) {
    assertFeature(snapshot, "customers");
  }
}

export async function assertCustomersEntitlement(
  sql: BillingSqlExecutor,
  scope: CustomerScope,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredCustomersEntitlement(snapshot);
}
