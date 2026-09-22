import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

const routes = [
  ["admin.finance.tsx", "/admin/finance"],
  ["admin.purchases.tsx", "/admin/purchases"],
  ["admin.suppliers.tsx", "/admin/suppliers"],
  ["admin.tasks.tsx", "/admin/tasks"],
  ["admin.coupons.tsx", "/admin/coupons"],
  ["admin.campaigns.tsx", "/admin/campaigns"],
] as const;

describe("admin real routes lot 3", () => {
  test("as seis áreas possuem file routes reais com loading e erro", () => {
    for (const [fileName, path] of routes) {
      const route = source(`apps/web/src/routes/${fileName}`);
      expect(route).toContain(`createFileRoute("${path}")`);
      expect(route).toContain("pendingComponent: AdminRoutePending");
      expect(route).toContain("errorComponent: AdminRouteError");
    }
  });

  test("menu aponta diretamente para as novas rotas sem hash", () => {
    const shell = source("apps/web/src/features/store-admin/admin-shell.tsx");
    for (const [, path] of routes) expect(shell).toContain(`to: "${path}"`);
    expect(shell).not.toContain('hash: "finance"');
    expect(shell).not.toContain('hash: "purchases"');
    expect(shell).not.toContain('hash: "suppliers"');
    expect(shell).not.toContain('hash: "tasks"');
    expect(shell).not.toContain('hash: "coupons"');
    expect(shell).not.toContain('hash: "campaigns"');
    expect(shell).not.toContain("includeHash");
  });

  test("route tree tipada registra todas as novas superfícies", () => {
    const tree = source("apps/web/src/routeTree.gen.ts");
    for (const [, path] of routes) {
      expect(tree).toContain(`'${path}': typeof`);
      expect(tree).toContain(`fullPath: '${path}'`);
    }
    expect(tree).not.toContain("@ts-expect-error");
    expect(tree).not.toContain("@ts-ignore");
  });

  test("novas telas reutilizam os managers existentes", () => {
    expect(source("apps/web/src/routes/admin.finance.tsx")).toContain("<MerchantFinanceManager");
    expect(source("apps/web/src/routes/admin.purchases.tsx")).toContain("<MerchantPurchasesManager");
    expect(source("apps/web/src/routes/admin.suppliers.tsx")).toContain("<MerchantSuppliersManager");
    expect(source("apps/web/src/routes/admin.tasks.tsx")).toContain("<MerchantTasksManager");
    expect(source("apps/web/src/routes/admin.coupons.tsx")).toContain("<CouponManager");
    expect(source("apps/web/src/routes/admin.campaigns.tsx")).toContain("<CampaignManager");
  });

  test("operações expõe histórico real e marketing permanece como compatibilidade", () => {
    const shell = source("apps/web/src/features/store-admin/admin-shell.tsx");
    const operations = source("apps/web/src/routes/admin.operations.tsx");
    const marketing = source("apps/web/src/routes/admin.marketing.tsx");
    expect(operations).toContain('createFileRoute("/admin/operations")');
    expect(operations).toContain('to="/admin/finance"');
    expect(operations).toContain('to="/admin/purchases"');
    expect(operations).not.toContain("window.location.hash");
    expect(marketing).toContain('createFileRoute("/admin/marketing")');
    expect(marketing).toContain('to="/admin/coupons"');
    expect(marketing).toContain('to="/admin/campaigns"');
    expect(marketing).not.toContain('id="coupons"');
    expect(marketing).not.toContain('id="campaigns"');
    expect(operations).toContain("<MerchantAuditLog");
    expect(shell).toContain('to: "/admin/operations"');
    expect(shell).not.toContain('to: "/admin/marketing"');
  });
});
