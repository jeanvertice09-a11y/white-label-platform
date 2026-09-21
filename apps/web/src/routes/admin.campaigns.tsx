import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { CampaignManager } from "../features/store-admin/campaign-manager.tsx";
import { listMerchantCampaigns } from "../lib/server/operations-marketing.functions.ts";

export const Route = createFileRoute("/admin/campaigns")({
  loader: async () => ({
    campaigns: await listMerchantCampaigns({ data: { page: 1, pageSize: 20 } }),
  }),
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: CampaignsPage,
});

function CampaignsPage(): React.JSX.Element {
  const { campaigns } = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Campanhas" description="Prepare campanhas para sua base de clientes usando a segmentação e o consentimento já existentes." />
    <CampaignManager initialPage={campaigns} />
  </div>;
}
