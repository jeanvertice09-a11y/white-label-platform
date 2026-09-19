import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("merchant operations entitlement boundary", () => {
  test("server functions aplicam features comerciais antes do repository", () => {
    const server = source("apps/web/src/lib/server/operations-merchant.functions.ts");
    expect(server).toContain("await assertMerchantOperationsEntitlements(current.sql, current.scope, features);");
    expect(server.match(/context\(\["suppliers"\]\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(server.match(/context\(\["purchases"\]\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(server).toContain('const features: MerchantOperationsFeature[] = ["purchases", "inventory"];');
    expect(server).toContain('context(["purchases", "inventory"])');
    expect(server.match(/context\(\["finance"\]\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(server).toContain('const features: MerchantOperationsFeature[] = ["finance"];');
    expect(server).toContain('if (data.supplierId) features.push("suppliers");');
    expect(server).toContain('if (data.purchaseId) features.push("purchases");');
  });

  test("rota só carrega áreas habilitadas e preserva estoque como dependência da compra", () => {
    const route = source("apps/web/src/routes/admin.operations.tsx");
    const page = source("apps/web/src/features/store-admin/merchant-operations-page.tsx");
    expect(route).toContain("const access = await getMerchantOperationsAccess();");
    expect(route).toContain("access.suppliers ?");
    expect(route).toContain("access.purchases ?");
    expect(route).toContain("access.finance ?");
    expect(route).toContain("access.purchases && access.inventory ?");
    expect(page).toContain("inventoryEnabled={props.access.inventory}");
  });
});
