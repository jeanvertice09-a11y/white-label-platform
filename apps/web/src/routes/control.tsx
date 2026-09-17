import { createFileRoute } from "@tanstack/react-router";
import { loadControlContext } from "../lib/client-guard.ts";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/control")({
  loader: () => loadControlContext(),
  errorComponent: AccessDenied,
  component: () => (
    <section>
      <h1>Tenant Control</h1>
      <p>Requer membership válida no tenant (tenant_owner/admin/finance/support).</p>
    </section>
  ),
});