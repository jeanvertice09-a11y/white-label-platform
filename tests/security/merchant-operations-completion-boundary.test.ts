import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> { return Bun.file(path).text(); }

describe("merchant operations completion boundary", () => {
  test("product quick actions stay tenant/store scoped and audited", async () => {
    const functions = await source("apps/web/src/lib/server/catalog-admin.functions.ts");
    expect(functions).toContain("setMerchantProductStatus");
    expect(functions).toContain("duplicateMerchantProduct");
    expect(functions).toContain("where tenant_id=$1 and store_id=$2 and id=$3::uuid");
    expect(functions).toContain("'product.status_changed'");
    expect(functions).toContain("'product.duplicated'");
    expect(functions).not.toContain("delete from public.products");
  });

  test("merchant mutations emit scoped audit events without browser authority", async () => {
    const functions = await source("apps/web/src/lib/server/operations-merchant.functions.ts");
    expect(functions).toContain("actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata");
    expect(functions).toContain("current.scope.tenantId");
    expect(functions).toContain("current.scope.storeId");
    expect(functions).toContain('"purchase.received"');
    expect(functions).toContain('"finance.entry_settled"');
    expect(functions).toContain('"task.status_changed"');
    expect(functions).not.toContain("tenantId: z.string()");
    expect(functions).not.toContain("storeId: z.string()");
  });

  test("dashboard activity queries are bounded and scoped", async () => {
    const dashboard = await source("apps/web/src/lib/server/operations-dashboard.functions.ts");
    expect(dashboard).toContain("loadMerchantDashboardActivity");
    expect(dashboard.match(/limit 5/g)?.length).toBeGreaterThanOrEqual(3);
    expect(dashboard.match(/tenant_id=\$1/g)?.length).toBeGreaterThanOrEqual(3);
    expect(dashboard.match(/store_id=\$2/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test("manual sale sends only IDs and quantities while server resolves prices", async () => {
    const server = await source("apps/web/src/lib/server/operations-orders.functions.ts");
    const form = await source("apps/web/src/features/store-admin/manual-order-form.tsx");
    expect(server).toContain('origin: "manual"');
    expect(server).toContain("createFromCart(current.scope");
    expect(server).toContain("'order.manual_created'");
    expect(server).toContain("where not exists (");
    expect(form).toContain("productId: option.productId");
    expect(form).toContain("variantId: option.variantId");
    expect(form).toContain("quantity }");
    const submission = form.slice(form.indexOf("const order = await createMerchantManualOrder"), form.indexOf("await router.navigate"));
    expect(submission).not.toContain("priceCents");
    expect(form).not.toContain("tenantId:");
    expect(form).not.toContain("storeId:");
  });

  test("merchant audit history is limited to the authenticated store", async () => {
    const audit = await source("apps/web/src/lib/server/merchant-audit.functions.ts");
    expect(audit).toContain("createMerchantOperationsContext(getRequestHost())");
    expect(audit).toContain("where tenant_id=$1::uuid and store_id=$2::uuid");
    expect(audit).not.toContain("tenantId: z.string()");
    expect(audit).not.toContain("storeId: z.string()");
    expect(audit).not.toContain("metadata:");
  });
});
