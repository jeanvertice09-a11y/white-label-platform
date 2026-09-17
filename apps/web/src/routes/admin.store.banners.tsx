import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { BannersPanel } from "../features/store-admin/banners-panel.tsx";
import { AdminPage } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/store/banners")({
  loader: () => getMerchantCatalogOverview(),
  component: BannersPage,
});

function BannersPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <AdminPage title="Banners" description="Gerencie os banners exibidos no catálogo público.">
      <BannersPanel banners={data.banners} />
    </AdminPage>
  );
}
