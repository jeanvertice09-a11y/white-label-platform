import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

const routeFiles = [
  "admin.finance.tsx",
  "admin.purchases.tsx",
  "admin.suppliers.tsx",
  "admin.tasks.tsx",
  "admin.coupons.tsx",
  "admin.campaigns.tsx",
] as const;

describe("admin real routes lot 3 security boundary", () => {
  test("novas rotas não aceitam tenant, store, usuário ou role do browser como autoridade", () => {
    for (const name of routeFiles) {
      const route = source(`apps/web/src/routes/${name}`);
      expect(route).not.toContain("tenantId");
      expect(route).not.toContain("storeId");
      expect(route).not.toContain("userId");
      expect(route).not.toContain("store_owner");
      expect(route).not.toContain("store_admin");
      expect(route).not.toContain("store_manager");
    }
  });

  test("todas as rotas filhas continuam sob o boundary autenticado do /admin", () => {
    const parent = source("apps/web/src/routes/admin.tsx");
    const boundary = source("apps/web/src/lib/server/route-context.server.ts");
    expect(parent).toContain("loader: () => loadStoreAdminContext()");
    expect(parent).toContain("<AdminShell><Outlet /></AdminShell>");
    expect(boundary).toContain('requireDomain(await deps.resolveTenantForHost(host), "store_admin")');
    expect(boundary).toContain("assertCanAccessStoreAdmin({ storeRoles: ctx.storeRoles })");
  });

  test("contexto de operações continua reconstruído server-side pelo host autenticado", () => {
    const context = source("apps/web/src/lib/server/operations-context.server.ts");
    expect(context).toContain("const deps = await createRealDeps();");
    expect(context).toContain("const auth = await loadStoreAdmin({ host }, deps);");
    expect(context).toContain("tenantId: String(auth.tenantId)");
    expect(context).toContain("storeId: String(auth.storeId)");
    expect(context).toContain("userId: String(auth.userId)");
  });

  test("loaders reutilizam server functions protegidas sem repositories no browser", () => {
    const finance = source("apps/web/src/routes/admin.finance.tsx");
    const purchases = source("apps/web/src/routes/admin.purchases.tsx");
    const suppliers = source("apps/web/src/routes/admin.suppliers.tsx");
    const tasks = source("apps/web/src/routes/admin.tasks.tsx");
    const coupons = source("apps/web/src/routes/admin.coupons.tsx");
    const campaigns = source("apps/web/src/routes/admin.campaigns.tsx");

    expect(finance).toContain("getMerchantOperationsAccess");
    expect(finance).toContain("listMerchantFinance");
    expect(purchases).toContain("listMerchantPurchases");
    expect(purchases).toContain("access.inventory");
    expect(suppliers).toContain("listMerchantSuppliers");
    expect(tasks).toContain("listMerchantTasks");
    expect(coupons).toContain("listMerchantCoupons");
    expect(campaigns).toContain("listMerchantCampaigns");

    const routes = [finance, purchases, suppliers, tasks, coupons, campaigns].join("\n");
    expect(routes).not.toContain("createAdminSqlExecutor");
    expect(routes).not.toContain("PostgresMerchantOperationsRepository");
    expect(routes).not.toContain("createCouponRepository");
    expect(routes).not.toContain("createCampaignRepository");
  });

  test("mutations continuam atrás dos guards centrais de entitlement e escopo", () => {
    const operations = source("apps/web/src/lib/server/operations-merchant.functions.ts");
    const marketing = source("apps/web/src/lib/server/operations-marketing.functions.ts");
    expect(operations).toContain("createMerchantOperationsContext(getRequestHost())");
    expect(operations).toContain("await assertMerchantOperationsEntitlements(current.sql, current.scope, features);");
    expect(operations).toContain('context(["suppliers"])');
    expect(operations).toContain('context(["purchases", "inventory"])');
    expect(operations).toContain('context(["finance"])');
    expect(marketing).toContain("createMerchantOperationsContext(getRequestHost())");
    expect(marketing).toContain("await assertCouponsEntitlement(current.sql, current.scope);");
    expect(marketing).toContain("await assertCampaignsEntitlement(current.sql, current.scope);");
  });
});
