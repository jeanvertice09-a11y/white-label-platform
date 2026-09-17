import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/catalog")({
  loader: () => getMerchantCatalogOverview(),
  component: CatalogSettingsPage,
});

function CatalogSettingsPage() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Configurações do catálogo"
        description="Controle visibilidade, WhatsApp, checkout e SEO do catálogo público."
      />
      <CatalogSettingsForm settings={data.settings} />
    </div>
  );
}
