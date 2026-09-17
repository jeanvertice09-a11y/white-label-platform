import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { AdminPage } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/store/catalog")({
  loader: () => getMerchantCatalogOverview(),
  component: CatalogSettingsPage,
});

function CatalogSettingsPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <AdminPage
      title="Configurações do catálogo"
      description="Busca, categorias, preços, WhatsApp, checkout e SEO."
    >
      <CatalogSettingsForm settings={data.settings} />
    </AdminPage>
  );
}
