import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/store-admin/admin-shell.tsx";
import { loadStoreAdminContext } from "../lib/client-guard.ts";
import "../styles/admin.css";
import "../styles/dashboard-rich.css";
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
