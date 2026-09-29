import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CouponManager } from "../features/store-admin/coupon-manager.tsx";
import { listMerchantCoupons } from "../lib/server/operations-marketing.functions.ts";

export const Route = createFileRoute("/admin/coupons")({
  loader: async () => ({ coupons: await listMerchantCoupons() }),
  pendingComponent: () => <EmptyState title="Carregando cupons" description="Buscando as promoções da sua loja." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar os cupons" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: CouponsPage,
});

function CouponsPage(): React.JSX.Element {
  const { coupons } = Route.useLoaderData();
  return <><PageHeader title="Cupons" description="Crie e gerencie regras promocionais da loja com vigência, limites e pedido mínimo." /><CouponManager coupons={coupons} /></>;
}
