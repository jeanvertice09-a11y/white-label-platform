import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/appearance")({
  loader: () => getMerchantCatalogOverview(),
  component: AppearancePage,
});

function AppearancePage() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Aparência da loja"
        description="Escolha o layout e personalize cores de forma estruturada e segura."
      />
      <CatalogSettingsForm settings={data.settings} />
    </div>
  );
}
