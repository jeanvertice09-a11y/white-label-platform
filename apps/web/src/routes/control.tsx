import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlShell } from "../features/control/control-shell.tsx";
import { getTenantControlDashboard } from "../lib/server/platform-console.functions.ts";
import "../styles/control.css";
import "../styles/control-plans.css";
import "../styles/console-system.css";
import "../styles/console-compat.css";
import "../styles/console-pages.css";
import "../styles/editorial-console.css";
import "../styles/panel-navigation-lot1.css";
import "../styles/control-real-routes.css";

export const Route = createFileRoute("/control")({
  loader: () => getTenantControlDashboard(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlLayout,
});

function ControlLayout(): React.JSX.Element {
  return <ControlShell data={Route.useLoaderData()} />;
}
