import { createFileRoute } from "@tanstack/react-router";
import { ControlDashboard } from "../features/control/control-dashboard.tsx";
import { loadControlContext } from "../lib/client-guard.ts";
import { getTenantControlDashboard } from "../lib/server/platform-console.functions.ts";
import "../styles/control.css";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/control")({
  loader: async () => {
    await loadControlContext();
    return getTenantControlDashboard();
  },
  errorComponent: AccessDenied,
  component: ControlPage,
});

function ControlPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <ControlDashboard data={data} />;
}
