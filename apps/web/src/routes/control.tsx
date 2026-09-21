import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlAuditManager } from "../features/control/control-audit-manager.tsx";
import { ControlBrandingManager } from "../features/control/control-branding-manager.tsx";
import { ControlDashboard } from "../features/control/control-dashboard.tsx";
import { ControlDomainManager } from "../features/control/control-domain-manager.tsx";
import { ControlGatewayManager } from "../features/control/control-gateway-manager.tsx";
import { ControlMerchantsManager } from "../features/control/control-merchants-manager.tsx";
import { ControlPlanManager } from "../features/control/control-plan-manager.tsx";
import { ControlTenantBilling } from "../features/control/control-tenant-billing.tsx";
import { loadControlContext } from "../lib/client-guard.ts";
import { getControlAuditWorkspace } from "../lib/server/control-audit.functions.ts";
import { getControlDomainWorkspace } from "../lib/server/control-domains.functions.ts";
import { getControlGatewayWorkspace } from "../lib/server/control-gateways.functions.ts";
import { getControlMerchantWorkspace } from "../lib/server/control-merchants.functions.ts";
import { getTenantPlanCatalog } from "../lib/server/commercial-plans.functions.ts";
import { getTenantControlDashboard } from "../lib/server/platform-console.functions.ts";
import { getControlTenantBillingWorkspace } from "../lib/server/tenant-billing.functions.ts";
import "../styles/control.css";
import "../styles/control-plans.css";
import "../styles/console-system.css";
import "../styles/console-compat.css";
import "../styles/console-pages.css";
import "../styles/editorial-console.css";
import "../styles/panel-navigation-lot1.css";

export const Route = createFileRoute("/control")({
  loader: async () => {
    await loadControlContext();
    const [dashboard, planCatalog, merchants, domains, gateways, billing, audit] = await Promise.all([
      getTenantControlDashboard(),
      getTenantPlanCatalog(),
      getControlMerchantWorkspace(),
      getControlDomainWorkspace(),
      getControlGatewayWorkspace(),
      getControlTenantBillingWorkspace(),
      getControlAuditWorkspace(),
    ]);
    return { dashboard, planCatalog, merchants, domains, gateways, billing, audit };
  },
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlPage,
});

function ControlPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <ControlDashboard data={data.dashboard} billing={data.billing}>
      <ControlTenantBilling initial={data.billing} />
      <ControlMerchantsManager initial={data.merchants} />
      <section className="control-plan-management-shell" id="plan-management">
        <div className="control-plan-management">
          <header>
            <span>Planos comerciais</span>
            <h2>Oferta para lojistas</h2>
            <p>Defina preço, periodicidade, período de teste, recursos e limites dentro do que a Kataluu disponibiliza.</p>
          </header>
          <div id="plan-resources">
            <ControlPlanManager catalog={data.planCatalog} />
          </div>
        </div>
      </section>
      <ControlBrandingManager initial={data.dashboard.tenant} />
      <ControlDomainManager initial={data.domains} />
      <ControlGatewayManager initial={data.gateways} />
      <ControlAuditManager initial={data.audit} />
    </ControlDashboard>
  );
}
