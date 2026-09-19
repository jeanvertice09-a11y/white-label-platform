import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { MasterShell } from "../components/master/MasterShell.tsx";
import { loadMasterContext } from "../lib/client-guard.ts";
import "../styles/master.css";
import "../styles/master-data.css";
import "../styles/console-system.css";
import "../styles/console-compat.css";
import "../styles/console-pages.css";

export const Route = createFileRoute("/master")({
  loader: () => loadMasterContext(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: MasterShell,
});
