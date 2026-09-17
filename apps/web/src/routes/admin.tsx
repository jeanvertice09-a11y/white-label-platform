import { createFileRoute } from "@tanstack/react-router";
import { loadStoreAdminContext } from "../lib/client-guard.ts";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/admin")({
  loader: () => loadStoreAdminContext(),
  errorComponent: AccessDenied,
  component: () => (
    <section>
      <h1>Store Admin</h1>
      <p>Requer store_owner / store_admin / store_manager na store ativa.</p>
    </section>
  ),
});