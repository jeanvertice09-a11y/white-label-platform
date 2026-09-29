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

  test("dashboard mantém resumo e onboarding independentes", () => {
    const dashboard = source("apps/web/src/routes/admin.index.tsx");
    expect(dashboard).toContain("Promise.allSettled");
    expect(dashboard).toContain('operations.status === "fulfilled"');
    expect(dashboard).toContain('onboarding.status === "fulfilled"');
    expect(dashboard).toContain("Tentar de novo");
    expect(dashboard).toContain("<FirstSteps onboarding={onboarding} />");
  });

  test("navegação usa as rotas reais do painel", () => {
    const shell = source("apps/web/src/admin/shell/AdminShell.tsx");
    const layout = source("apps/web/src/routes/admin.tsx");
    for (const path of ["/admin/coupons", "/admin/campaigns", "/admin/finance"]) {
      expect(shell).toContain(`"${path}"`);
    }
    expect(layout).toContain('import { AdminShell } from "../admin/shell/AdminShell.tsx"');
    expect(shell).not.toContain('"/admin/marketing"');
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

  test("relatórios continuam com acesso ao histórico da loja", () => {
    const shell = source("apps/web/src/admin/shell/AdminShell.tsx");
    const operations = source("apps/web/src/routes/admin.operations.tsx");
    expect(operations).toContain('createFileRoute("/admin/operations")');
    expect(operations).toContain("<MerchantAuditLog");
    expect(shell).toContain('"/admin/operations"');
  });
});
