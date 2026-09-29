import { describe, expect, test } from "bun:test";

const serverPath = "apps/web/src/lib/server/bulk-import.functions.ts";
const onboardingPath = "apps/web/src/lib/server/onboarding.functions.ts";

describe("bulk import and onboarding isolation contracts", () => {
  test("derives merchant scope server-side and never accepts tenant/store/user from payload", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toContain("createMerchantCatalogContext(getRequestHost())");
    expect(source).toContain("context.scope.tenantId");
    expect(source).toContain("context.scope.storeId");
    expect(source).toContain("context.userId");
    expect(source).not.toContain("tenantId: z.");
    expect(source).not.toContain("storeId: z.");
    expect(source).not.toContain("userId: z.");
  });

  test("checks existing products, variants and categories only inside current store scope", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toContain("where tenant_id=$1::uuid and store_id=$2::uuid");
    expect(source).toContain("context.repository.listCategories(context.scope, false)");
    expect(source).toContain("assertProductMutationEntitlements(sql, context.scope, \"create\", rows.length)");
    expect(source).toContain("assertVariantMutationEntitlements");
  });

  test("commits products, variants, initial inventory and audit in one SQL statement", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toContain("with payload as");
    expect(source).toContain("inserted_products as");
    expect(source).toContain("inserted_variants as");
    expect(source).toContain("product_stock as");
    expect(source).toContain("variant_stock as");
    expect(source).toContain("products.bulk_imported");
  });

  test("onboarding facts are queried with tenant and store scope and no localStorage", async () => {
    const source = await Bun.file(onboardingPath).text();
    expect(source).toContain("createMerchantCatalogContext(getRequestHost())");
    expect(source).toContain("tenant_id=$1::uuid");
    expect(source).toContain("store_id=$2::uuid");
    expect(source).not.toContain("localStorage");
  });
});
