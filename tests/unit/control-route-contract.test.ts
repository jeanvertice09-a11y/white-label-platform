import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

const routeContracts = [
  ["apps/web/src/routes/control.index.tsx", 'createFileRoute("/control/")', "getControlTenantBillingWorkspace"],
  ["apps/web/src/routes/control.stores.tsx", 'createFileRoute("/control/stores")', "getControlMerchantWorkspace"],
  ["apps/web/src/routes/control.billing.tsx", 'createFileRoute("/control/billing")', "getControlTenantBillingWorkspace"],
  ["apps/web/src/routes/control.plans.tsx", 'createFileRoute("/control/plans")', "getTenantPlanCatalog"],
  ["apps/web/src/routes/control.domains.tsx", 'createFileRoute("/control/domains")', "getControlDomainWorkspace"],
  ["apps/web/src/routes/control.payments.tsx", 'createFileRoute("/control/payments")', "getControlGatewayWorkspace"],
  ["apps/web/src/routes/control.audit.tsx", 'createFileRoute("/control/audit")', "getControlAuditWorkspace"],
] as const;

describe("control route contracts", () => {
  test("cada superfície com dados próprios reutiliza o loader autoritativo existente", () => {
    for (const [path, route, loader] of routeContracts) {
      const file = source(path);
      expect(file).toContain(route);
      expect(file).toContain(loader);
    }
  });

  test("branding e equipe reutilizam o contexto server-side do shell sem duplicar autoridade", () => {
    const parent = source("apps/web/src/routes/control.tsx");
    const branding = source("apps/web/src/features/control/control-branding-page.tsx");
    const team = source("apps/web/src/features/control/control-team-page.tsx");
    expect(parent).toContain("getTenantControlDashboard");
    expect(branding).toContain("useControlShellData");
    expect(team).toContain("useControlShellData");
  });

  test("detalhe da loja é rota real e continua tenant-scoped pelo backend existente", () => {
    const route = source("apps/web/src/routes/control.stores_.$storeId.tsx");
    const functions = source("apps/web/src/lib/server/control-merchants.functions.ts");
    const read = source("apps/web/src/lib/server/control-merchants.read.server.ts");
    expect(route).toContain('createFileRoute("/control/stores_/$storeId")');
    expect(route).toContain("getControlMerchant({ data: { storeId } })");
    expect(functions).toContain("ctx.tenantId");
    expect(read).toContain("s.tenant_id=$1::uuid and s.id=$2::uuid");
  });

  test("shell usa Outlet e navegação real, sem restaurar a mega-rota", () => {
    const parent = source("apps/web/src/routes/control.tsx");
    const shell = source("apps/web/src/features/control/control-shell.tsx");
    const navigation = source("apps/web/src/features/control/control-navigation.ts");
    expect(shell).toContain("<Outlet />");
    expect(shell).toContain("<Link");
    expect(parent).not.toContain("Promise.all");
    for (const anchor of ["#overview", "#tenant-billing", "#merchant-management", "#plan-management", "#branding", "#domain-management", "#gateway-management", "#access", "#audit"]) {
      expect(navigation).not.toContain(anchor);
    }
  });

  test("loaders expõem estados de loading/error e o shell mantém suporte mobile", () => {
    const parent = source("apps/web/src/routes/control.tsx");
    const routed = routeContracts.map(([path]) => source(path)).join("\n");
    const mobile = source("apps/web/src/styles/panel-navigation-lot1.css") + source("apps/web/src/styles/control-real-routes.css");
    expect(parent).toContain("pendingComponent: ConsoleRoutePending");
    expect(parent).toContain("errorComponent: ConsoleRouteError");
    expect(routed).toContain("pendingComponent: ConsoleRoutePending");
    expect(routed).toContain("errorComponent: ConsoleRouteError");
    expect(mobile).toContain("100dvh");
    expect(mobile).toContain(".control-sidebar");
  });

  test("meios de pagamento continuam usando DTO seguro e sem segredos persistidos no browser", () => {
    const route = source("apps/web/src/routes/control.payments.tsx");
    const functions = source("apps/web/src/lib/server/control-gateways.functions.ts");
    const read = source("apps/web/src/lib/server/control-gateways.read.server.ts");
    const types = source("apps/web/src/lib/server/control-gateways.types.ts");
    const safeTypeStart = types.indexOf("export interface SafeGatewayAccount");
    const workspaceStart = types.indexOf("export interface ControlGatewayWorkspace");
    const safeType = types.slice(safeTypeStart, workspaceStart);

    expect(route).toContain("getControlGatewayWorkspace");
    expect(functions).toContain("loadControlGatewayWorkspace(ctx.sql, ctx.tenantId, ctx.canManage)");
    expect(read).toContain("listSafeGatewayAccounts");
    expect(read).toContain('configured: row["configured"] === true');
    expect(read).toContain('webhookConfigured: row["webhook_configured"] === true');
    expect(safeTypeStart).toBeGreaterThanOrEqual(0);
    expect(workspaceStart).toBeGreaterThan(safeTypeStart);
    expect(safeType).not.toContain("credentials");
    expect(safeType).not.toContain("webhookSecret");
    expect(route).not.toContain("credentials");
    expect(route).not.toContain("webhookSecret");
  });
});
