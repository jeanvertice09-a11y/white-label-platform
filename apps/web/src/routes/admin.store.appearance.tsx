import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { AdminPage } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/store/appearance")({
  loader: () => getMerchantCatalogOverview(),
  component: AppearancePage,
});

function AppearancePage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <AdminPage title="Aparência" description="Escolha layout, cores e tipografia do catálogo.">
      <CatalogSettingsForm settings={data.settings} mode="appearance" />
    </AdminPage>
  );
}
