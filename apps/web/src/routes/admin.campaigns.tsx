import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
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
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: CampaignsPage,
});

function CampaignsPage(): React.JSX.Element {
  const { campaigns, merchandising } = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Campanhas" description="Organize campanhas e o merchandising promocional do catálogo com as regras seguras já existentes." />
    <CampaignManager initialPage={campaigns} merchandising={merchandising} />
  </div>;
}
