import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CampaignManager } from "../features/store-admin/campaign-manager.tsx";
import { CouponManager } from "../features/store-admin/coupon-manager.tsx";
import {
  listMerchantCampaigns,
  listMerchantCoupons,
} from "../lib/server/operations-marketing.functions.ts";

export const Route = createFileRoute("/admin/marketing")({
  loader: async () => {
    const [coupons, campaigns] = await Promise.all([
      listMerchantCoupons(),
      listMerchantCampaigns({
        data: { page: 1, pageSize: 20 },
      }),
    ]);
    return { coupons, campaigns };
  },
  component: MarketingPage,
});

function MarketingPage(): React.JSX.Element {
  const { coupons, campaigns } = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Marketing"
        description="Crie promoções com cupons e prepare campanhas para sua base de clientes."
      />
      <div id="coupons"><CouponManager coupons={coupons} /></div>
      <div id="campaigns"><CampaignManager initialPage={campaigns} /></div>
    </div>
  );
}
