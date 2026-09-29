import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlPlanManager } from "../features/control/control-plan-manager.tsx";
import { getTenantPlanCatalog } from "../lib/server/commercial-plans.functions.ts";

interface PlansSearch {
  section?: "plans" | "resources";
}

export const Route = createFileRoute("/control/plans")({
  validateSearch: (search: Record<string, unknown>): PlansSearch => ({
    section: search["section"] === "resources" ? "resources" : "plans",
  }),
  loader: () => getTenantPlanCatalog(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlPlansRoute,
});

function ControlPlansRoute(): React.JSX.Element {
  const search = Route.useSearch();
  const resources = search.section === "resources";
  return <section className="control-plan-management-shell"><div className="control-plan-management">
    <header><span>Planos</span><h2>{resources ? "Recursos e limites" : "Planos comerciais"}</h2><p>{resources ? "Abra um plano para revisar os recursos e limites autorizados pela Kataluu, sem ampliar entitlements no navegador." : "Configure preço, periodicidade, trial, disponibilidade e oferta para lojistas dentro das regras existentes."}</p></header>
    <ControlPlanManager catalog={Route.useLoaderData()} />
  </div></section>;
}
