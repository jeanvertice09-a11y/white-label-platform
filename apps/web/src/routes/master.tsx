import { createFileRoute } from "@tanstack/react-router";
import { MasterShell } from "../components/master/MasterShell.tsx";
import { loadMasterContext } from "../lib/client-guard.ts";
import "../styles/master.css";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/master")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: MasterShell,
});
