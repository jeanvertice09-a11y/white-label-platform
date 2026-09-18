import {
  assertFeature,
  assertSubscriptionAccess,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type { MarketingScope } from "@white-label/marketing";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertConfiguredCampaignsEntitlement(
  snapshot: StoreSubscriptionSnapshot | null,
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (hasOwn(snapshot.features, "campaigns")) {
    assertFeature(snapshot, "campaigns");
  }
}

export async function assertCampaignsEntitlement(
  sql: BillingSqlExecutor,
  scope: MarketingScope,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredCampaignsEntitlement(snapshot);
}
