import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../features/store-admin/admin-shell.tsx";
import { loadStoreAdminContext } from "../lib/client-guard.ts";
import { getMerchantStorefrontStatus } from "../lib/server/catalog.functions.ts";
import "../styles/admin-zero.css";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    await loadStoreAdminContext();
    const storefront = await getMerchantStorefrontStatus().catch(() => null);
    return { storefrontUrl: storefront?.domain?.previewUrl ?? null };
  },
  errorComponent: AccessDenied,
  component: AdminLayout,
});

function AdminLayout(): React.JSX.Element {
  const { storefrontUrl } = Route.useLoaderData();
  return <AdminShell storefrontUrl={storefrontUrl}><Outlet /></AdminShell>;
}
