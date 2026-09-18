import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CouponManager } from "../features/store-admin/coupon-manager.tsx";
import { listMerchantCoupons } from "../lib/server/operations-marketing.functions.ts";

export const Route = createFileRoute("/admin/marketing")({
  loader: () => listMerchantCoupons(),
  component: MarketingPage,
});

function MarketingPage(): React.JSX.Element {
  const coupons = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title="Marketing" description="Cupons reais com validade, limite, mínimo e desconto percentual ou fixo." />
      <CouponManager coupons={coupons} />
    </div>
  );
}
