import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { HomePage } from "./routes/index.tsx";
import { MasterPage } from "./routes/master/index.tsx";
import { ControlPage } from "./routes/control/index.tsx";
import { StoreAdminPage } from "./routes/admin/index.tsx";
import { CatalogPage } from "./routes/catalog/index.tsx";
import { AccessDenied } from "./routes/access-denied.tsx";
import { loadControlContext, loadMasterContext, loadStoreAdminContext } from "./lib/client-guard.ts";

function Shell(): React.JSX.Element {
  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <strong>White Label Platform</strong>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/">Início</Link>
          <Link to="/master">Master</Link>
          <Link to="/control">Control</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/catalog">Catálogo</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

// Rotas protegidas: loader exige contexto do SERVIDOR (mesma origem).
// Sem contexto válido o loader lança e a rota renderiza AccessDenied —
// nunca o conteúdo. Fail closed por padrão. A decisão de autorização vive
// em lib/server/route-context.ts; o transporte Start (server functions)
// está em lib/server/functions.ts para o runtime SSR.
const rootRoute = createRootRoute({ component: Shell });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const masterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/master",
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: MasterPage,
});
const controlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/control",
  loader: () => loadControlContext(),
  errorComponent: AccessDenied,
  component: ControlPage,
});
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  loader: () => loadStoreAdminContext(),
  errorComponent: AccessDenied,
  component: StoreAdminPage,
});
const catalogRoute = createRoute({ getParentRoute: () => rootRoute, path: "/catalog", component: CatalogPage });

const routeTree = rootRoute.addChildren([homeRoute, masterRoute, controlRoute, adminRoute, catalogRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
