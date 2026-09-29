import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlOverview } from "../features/control/control-overview.tsx";
import { getControlOperationalHealth } from "../lib/server/control-operational-health.functions.ts";
import { getCurrentTenantStorefrontAnalytics } from "../lib/server/storefront-analytics.functions.ts";
import { getControlTenantBillingWorkspace } from "../lib/server/tenant-billing.functions.ts";

export const Route = createFileRoute("/control/")({
  loader: async () => {
    const [billing, health, analytics] = await Promise.all([
      getControlTenantBillingWorkspace(),
      getControlOperationalHealth(),
      getCurrentTenantStorefrontAnalytics(),
    ]);
    return { billing, health, analytics };
  },
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlOverviewRoute,
});

function ControlOverviewRoute(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <ControlOverview billing={data.billing} health={data.health} analytics={data.analytics} />;
}
