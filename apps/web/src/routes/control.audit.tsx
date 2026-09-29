import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlAuditManager } from "../features/control/control-audit-manager.tsx";
import { getControlAuditWorkspace } from "../lib/server/control-audit.functions.ts";

export const Route = createFileRoute("/control/audit")({
  loader: () => getControlAuditWorkspace(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlAuditRoute,
});

function ControlAuditRoute(): React.JSX.Element {
  return <ControlAuditManager initial={Route.useLoaderData()} />;
}
