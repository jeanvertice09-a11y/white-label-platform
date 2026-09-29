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

function assertConfiguredFeature(
  snapshot: StoreSubscriptionSnapshot | null,
  feature: "campaigns" | "coupons",
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (hasOwn(snapshot.features, feature)) {
    assertFeature(snapshot, feature);
  }
}

export function assertConfiguredCampaignsEntitlement(
  snapshot: StoreSubscriptionSnapshot | null,
): void {
  assertConfiguredFeature(snapshot, "campaigns");
}

export function assertConfiguredCouponsEntitlement(
  snapshot: StoreSubscriptionSnapshot | null,
): void {
  assertConfiguredFeature(snapshot, "coupons");
}

async function assertMarketingEntitlement(
  sql: BillingSqlExecutor,
  scope: MarketingScope,
  feature: "campaigns" | "coupons",
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredFeature(snapshot, feature);
}

export async function assertCampaignsEntitlement(
  sql: BillingSqlExecutor,
  scope: MarketingScope,
): Promise<void> {
  await assertMarketingEntitlement(sql, scope, "campaigns");
}

export async function assertCouponsEntitlement(
  sql: BillingSqlExecutor,
  scope: MarketingScope,
): Promise<void> {
  await assertMarketingEntitlement(sql, scope, "coupons");
}
