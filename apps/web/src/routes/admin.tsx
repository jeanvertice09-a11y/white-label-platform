import { createFileRoute, Outlet } from "@tanstack/react-router";
import { loadStoreAdminContext } from "../lib/client-guard.ts";
import { AdminShell } from "../features/store-admin/admin-shell.tsx";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/admin")({
  loader: () => loadStoreAdminContext(),
  errorComponent: AccessDenied,
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
