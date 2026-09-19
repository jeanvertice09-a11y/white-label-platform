import {
  assertFeature,
  assertSubscriptionAccess,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type { BillingSqlExecutor } from "@white-label/billing";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export async function assertStoreCustomDomainEntitlement(
  sql: BillingSqlExecutor,
  tenantId: string,
  storeId: string,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, { tenantId, storeId });
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (!hasOwn(snapshot.features, "custom_domain")) return;
  assertFeature(snapshot, "custom_domain");
}
