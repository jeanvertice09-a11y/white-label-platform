import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("platform/control UI boundary", () => {
  test("master e control usam o design system próprio sem o polish compartilhado do admin", () => {
    for (const route of ["apps/web/src/routes/master.tsx", "apps/web/src/routes/control.tsx"]) {
      const raw = source(route);
      expect(raw).toContain("console-system.css");
      expect(raw).toContain("console-compat.css");
      expect(raw).toContain("console-pages.css");
      expect(raw).not.toContain("dashboard-rich.css");
      expect(raw).not.toContain("dashboard-pages.css");
    }
  });

  test("control mantém todas as áreas operacionais sob o mesmo shell com rotas reais", () => {
    const parent = source("apps/web/src/routes/control.tsx");
    const shell = source("apps/web/src/features/control/control-shell.tsx");
    expect(parent).toContain("<ControlShell");
    expect(shell).toContain("<Outlet />");
    expect(parent).not.toContain("<ControlDashboard");

    const routes = [
      ["apps/web/src/routes/control.index.tsx", 'createFileRoute("/control/")'],
      ["apps/web/src/routes/control.stores.tsx", 'createFileRoute("/control/stores")'],
      ["apps/web/src/routes/control.billing.tsx", 'createFileRoute("/control/billing")'],
      ["apps/web/src/routes/control.plans.tsx", 'createFileRoute("/control/plans")'],
      ["apps/web/src/routes/control.branding.tsx", 'createFileRoute("/control/branding")'],
      ["apps/web/src/routes/control.domains.tsx", 'createFileRoute("/control/domains")'],
      ["apps/web/src/routes/control.payments.tsx", 'createFileRoute("/control/payments")'],
      ["apps/web/src/routes/control.team.tsx", 'createFileRoute("/control/team")'],
      ["apps/web/src/routes/control.audit.tsx", 'createFileRoute("/control/audit")'],
    ] as const;

    for (const [path, contract] of routes) {
      expect(source(path)).toContain(contract);
    }
  });

  test("design system administrativo não reintroduz gradientes decorativos e preserva acessibilidade responsiva", () => {
    const system = source("apps/web/src/styles/console-system.css");
    const pages = source("apps/web/src/styles/console-pages.css");
    expect(system).not.toContain("linear-gradient(");
    expect(system).not.toContain("conic-gradient(");
    expect(system).toContain("prefers-reduced-motion");
    expect(system).toContain("focus-visible");
    expect(system).toContain("@media (max-width: 760px)");
    expect(pages).toContain(".sr-only");
  });

  test("shells possuem atalho de teclado para o conteúdo principal", () => {
    expect(source("apps/web/src/components/master/MasterShell.tsx")).toContain("console-skip-link");
    expect(source("apps/web/src/features/control/control-shell.tsx")).toContain("console-skip-link");
  });

  test("rotas administrativas possuem pending estruturado e erro contextual com retry", () => {
    for (const route of ["apps/web/src/routes/master.tsx", "apps/web/src/routes/control.tsx"]) {
      const raw = source(route);
      expect(raw).toContain("pendingComponent: ConsoleRoutePending");
      expect(raw).toContain("errorComponent: ConsoleRouteError");
    }
    const state = source("apps/web/src/components/console/ConsoleRouteState.tsx");
    expect(state).toContain("aria-busy=\"true\"");
    expect(state).toContain("Tentar novamente");
    expect(state).toContain("error.status === 401");
    expect(state).toContain("error.status === 403");
    expect(state).toContain("error.status === 404");
  });
});
