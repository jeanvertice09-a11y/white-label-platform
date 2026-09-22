import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/store-admin/admin-shell.tsx";
import { loadStoreAdminContext } from "../lib/client-guard.ts";
import "../styles/admin.css";
import "../styles/dashboard-rich.css";
import "../styles/dashboard-pages.css";
import "../styles/merchant-uiux.css";
import "../styles/responsive-merchant.css";
import "../styles/responsive-merchant-qa.css";
import "../styles/bulk-onboarding.css";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/admin")({
  loader: () => loadStoreAdminContext(),
  errorComponent: AccessDenied,
  component: () => <AdminShell><Outlet /></AdminShell>,
});
