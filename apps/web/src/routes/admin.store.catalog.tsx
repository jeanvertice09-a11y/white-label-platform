import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/catalog")({
  loader: () => getMerchantCatalogOverview(),
  component: CatalogSettingsPage,
});

function CatalogSettingsPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title="Configurar minha loja" description="Deixe seu catálogo pronto para vender. São poucos passos e você pode alterar tudo depois." /><CatalogSettingsForm settings={data.settings} /></>;
}
