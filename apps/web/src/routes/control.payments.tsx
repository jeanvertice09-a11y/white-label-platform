import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlGatewayManager } from "../features/control/control-gateway-manager.tsx";
import { getControlGatewayWorkspace } from "../lib/server/control-gateways.functions.ts";

export const Route = createFileRoute("/control/payments")({
  loader: () => getControlGatewayWorkspace(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlPaymentsRoute,
});

function ControlPaymentsRoute(): React.JSX.Element {
  return <ControlGatewayManager initial={Route.useLoaderData()} />;
}
