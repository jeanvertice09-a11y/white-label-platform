import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlTenantBilling } from "../features/control/control-tenant-billing.tsx";
import { getControlTenantBillingWorkspace } from "../lib/server/tenant-billing.functions.ts";

export const Route = createFileRoute("/control/billing")({
  loader: () => getControlTenantBillingWorkspace(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlBillingRoute,
});

function ControlBillingRoute(): React.JSX.Element {
  return <ControlTenantBilling initial={Route.useLoaderData()} />;
}
