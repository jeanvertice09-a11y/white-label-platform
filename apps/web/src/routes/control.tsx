import { createFileRoute } from "@tanstack/react-router";
import { ControlDashboard } from "../features/control/control-dashboard.tsx";
import { ControlDomainManager } from "../features/control/control-domain-manager.tsx";
import { ControlMerchantsManager } from "../features/control/control-merchants-manager.tsx";
import { ControlPlanManager } from "../features/control/control-plan-manager.tsx";
import { loadControlContext } from "../lib/client-guard.ts";
import { getControlDomainWorkspace } from "../lib/server/control-domains.functions.ts";
import { getControlMerchantWorkspace } from "../lib/server/control-merchants.functions.ts";
import { getTenantPlanCatalog } from "../lib/server/commercial-plans.functions.ts";
import { getTenantControlDashboard } from "../lib/server/platform-console.functions.ts";
import "../styles/control.css";
import "../styles/control-plans.css";
import "../styles/dashboard-rich.css";
import "../styles/dashboard-pages.css";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/control")({
  loader: async () => {
    await loadControlContext();
    const [dashboard, planCatalog, merchants, domains] = await Promise.all([
      getTenantControlDashboard(),
      getTenantPlanCatalog(),
      getControlMerchantWorkspace(),
      getControlDomainWorkspace(),
    ]);
    return { dashboard, planCatalog, merchants, domains };
  },
  errorComponent: AccessDenied,
  component: ControlPage,
});

function ControlPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <>
      <ControlDashboard data={data.dashboard} />
      <ControlMerchantsManager initial={data.merchants} />
      <ControlDomainManager initial={data.domains} />
      <section className="control-plan-management-shell" id="plan-management">
        <div className="control-plan-management">
          <header>
            <span>Planos comerciais</span>
            <h2>Configurar oferta para lojistas</h2>
            <p>Preço, periodicidade, trial, destaque, recursos e limites respeitam o teto definido pela Kataluu.</p>
          </header>
          <ControlPlanManager catalog={data.planCatalog} />
        </div>
      </section>
    </>
  );
}
