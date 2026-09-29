import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CampaignManager } from "../features/store-admin/campaign-manager.tsx";
import { getMerchantCatalogMerchandising } from "../lib/server/catalog-merchandising.functions.ts";
import { listMerchantCampaigns } from "../lib/server/operations-marketing.functions.ts";

export const Route = createFileRoute("/admin/campaigns")({
  loader: async () => {
    const [campaigns, merchandising] = await Promise.all([
      listMerchantCampaigns({ data: { page: 1, pageSize: 20 } }),
      getMerchantCatalogMerchandising(),
    ]);
    return { campaigns, merchandising };
  },
  pendingComponent: () => <EmptyState title="Carregando campanhas" description="Buscando campanhas e merchandising da loja." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar as campanhas" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: CampaignsPage,
});

function CampaignsPage(): React.JSX.Element {
  const { campaigns, merchandising } = Route.useLoaderData();
  return <><PageHeader title="Campanhas" description="Organize campanhas e o merchandising promocional do catálogo." /><CampaignManager initialPage={campaigns} merchandising={merchandising} /></>;
}
