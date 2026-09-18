import {
  assertFeature,
  assertSubscriptionAccess,
  assertWithinLimit,
  loadStoreEntitlementSnapshot,
} from "@white-label/billing";
import type {
  BillingSqlExecutor,
  StoreSubscriptionSnapshot,
} from "@white-label/billing";
import type { CatalogScope } from "@white-label/catalog";

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertConfiguredCatalogEntitlements(
  snapshot: StoreSubscriptionSnapshot | null,
  options: Readonly<{
    feature?: "products" | "variants";
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
): Promise<void> {
  const snapshot = await loadStoreEntitlementSnapshot(sql, scope);
  if (!snapshot) return;
  if (mode === "create" && hasOwn(snapshot.limits, "max_products")) {
    const currentUsage = await productCount(sql, scope);
    assertConfiguredCatalogEntitlements(snapshot, {
      feature: "products",
      maxProductsUsage: currentUsage,
      maxProductsIncrement: 1,
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
