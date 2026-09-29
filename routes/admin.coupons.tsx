import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { CouponManager } from "../features/store-admin/coupon-manager.tsx";
import { listMerchantCoupons } from "../lib/server/operations-marketing.functions.ts";

export const Route = createFileRoute("/admin/coupons")({
  loader: async () => ({ coupons: await listMerchantCoupons() }),
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: CouponsPage,
});

function CouponsPage(): React.JSX.Element {
  const { coupons } = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Cupons" description="Crie e gerencie regras promocionais da loja com vigência, limites e pedido mínimo." />
    <CouponManager coupons={coupons} />
  </div>;
}
