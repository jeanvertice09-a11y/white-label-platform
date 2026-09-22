import {
  assertFeature,
  assertSubscriptionAccess,
  assertWithinLimit,
  hasFeature,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type {
  CatalogLayout,
  CatalogScope,
  CatalogSettings,
} from "@white-label/catalog";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertConfiguredCatalogEntitlements(
  snapshot: StoreSubscriptionSnapshot | null,
  options: Readonly<{
    feature?: "products" | "variants" | "banners" | "layouts" | "online_payments";
    maxProductsUsage?: number;
    maxProductsIncrement?: number;
  }>,
): void {
  if (!snapshot) return;
  assertSubscriptionAccess(snapshot);
  if (options.feature && hasOwn(snapshot.features, options.feature)) {
    assertFeature(snapshot, options.feature);
  }
  if (
    options.maxProductsUsage !== undefined
    && hasOwn(snapshot.limits, "max_products")
  ) {
    assertWithinLimit(
      snapshot,
      "max_products",
      options.maxProductsUsage,
      options.maxProductsIncrement ?? 1,
    );
  }
}

function featureAvailable(
  snapshot: StoreSubscriptionSnapshot | null,
  key: "layouts" | "online_payments",
): boolean | null {
  if (!snapshot || !hasOwn(snapshot.features, key)) return null;
  return hasFeature(snapshot, key);
}

export function resolveConfiguredCatalogLayout(
  snapshot: StoreSubscriptionSnapshot | null,
  configured: CatalogLayout,
): CatalogLayout {
  if (configured === "classic") return "classic";
  const available = featureAvailable(snapshot, "layouts");
  return available === false ? "classic" : configured;
}

export function resolveConfiguredCatalogSettings(
  snapshot: StoreSubscriptionSnapshot | null,
  settings: CatalogSettings,
): CatalogSettings {
  const layout = resolveConfiguredCatalogLayout(snapshot, settings.layout);
  const onlineAvailable = featureAvailable(snapshot, "online_payments");
  const checkoutMode = onlineAvailable === false && settings.checkoutMode !== "whatsapp"
    ? "whatsapp"
    : settings.checkoutMode;
  return { ...settings, layout, checkoutMode };
}

async function productCount(
  sql: BillingSqlExecutor,
  scope: CatalogScope,
): Promise<number> {
  const rows = await sql.query(
    "select count(*)::integer as count from public.products where tenant_id=$1 and store_id=$2",
    [scope.tenantId, scope.storeId],
  );
  const count = Number(rows[0]?.["count"] ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Contagem de produtos inválida");
  return count;
}

export async function assertProductMutationEntitlements(
  sql: BillingSqlExecutor,
  scope: CatalogScope,
  mode: "create" | "update",
  createIncrement = 1,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  if (!snapshot) return;
  if (mode === "create" && hasOwn(snapshot.limits, "max_products")) {
    const currentUsage = await productCount(sql, scope);
    assertConfiguredCatalogEntitlements(snapshot, {
      feature: "products",
      maxProductsUsage: currentUsage,
      maxProductsIncrement: createIncrement,
    });
    return;
  }
  assertConfiguredCatalogEntitlements(snapshot, { feature: "products" });
}

export async function assertVariantMutationEntitlements(
  sql: BillingSqlExecutor,
  scope: CatalogScope,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredCatalogEntitlements(snapshot, { feature: "variants" });
}

export async function assertCatalogFeatureEntitlement(
  sql: BillingSqlExecutor,
  scope: CatalogScope,
  feature: "banners",
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  assertConfiguredCatalogEntitlements(snapshot, { feature });
}

export async function assertCatalogSettingsEntitlements(
  sql: BillingSqlExecutor,
  scope: CatalogScope,
  settings: Pick<CatalogSettings, "layout" | "checkoutMode">,
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  if (settings.layout === "modern") {
    assertConfiguredCatalogEntitlements(snapshot, { feature: "layouts" });
  }
  if (settings.checkoutMode !== "whatsapp") {
    assertConfiguredCatalogEntitlements(snapshot, { feature: "online_payments" });
  }
}

export async function resolveCatalogSettingsEntitlements(
  sql: BillingSqlExecutor,
  scope: CatalogScope,
  settings: CatalogSettings,
): Promise<CatalogSettings> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  return resolveConfiguredCatalogSettings(snapshot, settings);
}
