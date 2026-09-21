import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlDomainManager } from "../features/control/control-domain-manager.tsx";
import { getControlDomainWorkspace } from "../lib/server/control-domains.functions.ts";

export const Route = createFileRoute("/control/domains")({
  loader: () => getControlDomainWorkspace(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlDomainsRoute,
});

function ControlDomainsRoute(): React.JSX.Element {
  return <ControlDomainManager initial={Route.useLoaderData()} />;
}
