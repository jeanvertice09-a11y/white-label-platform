import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlOverview } from "../features/control/control-overview.tsx";
import { getControlTenantBillingWorkspace } from "../lib/server/tenant-billing.functions.ts";

export const Route = createFileRoute("/control/")({
  loader: () => getControlTenantBillingWorkspace(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlOverviewRoute,
});

function ControlOverviewRoute(): React.JSX.Element {
  return <ControlOverview billing={Route.useLoaderData()} />;
}
