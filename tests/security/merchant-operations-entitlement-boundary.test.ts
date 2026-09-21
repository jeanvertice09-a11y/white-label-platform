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

  test("rotas reais carregam somente as áreas habilitadas e preservam dependências", () => {
    const suppliers = source("apps/web/src/routes/admin.suppliers.tsx");
    const purchases = source("apps/web/src/routes/admin.purchases.tsx");
    const finance = source("apps/web/src/routes/admin.finance.tsx");
    const tasks = source("apps/web/src/routes/admin.tasks.tsx");

    expect(suppliers).toContain("const access = await getMerchantOperationsAccess();");
    expect(suppliers).toContain("access.suppliers");
    expect(purchases).toContain("if (!access.purchases)");
    expect(purchases).toContain("access.suppliers");
    expect(purchases).toContain("access.inventory");
    expect(purchases).toContain("inventoryEnabled={data.access.inventory}");
    expect(finance).toContain("if (!access.finance)");
    expect(finance).toContain("listMerchantFinancialCategories()");
    expect(tasks).toContain("access.tasks ? await listMerchantTasks() : []");
  });
});
