import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { OrdersList } from "../features/store-admin/orders-list.tsx";
import { listMerchantOrders } from "../lib/server/operations-orders.functions.ts";

export const Route = createFileRoute("/admin/orders/")({
  loader: () => listMerchantOrders({
    data: { page: 1, pageSize: 20 },
  }),
  pendingComponent: () => <div className="k-empty">Carregando pedidos…</div>,
  errorComponent: ({ error }) => (
    <div className="k-empty">
      {error instanceof Error ? error.message : "Não foi possível carregar os pedidos."}
    </div>
  ),
  component: OrdersPage,
});

function OrdersPage(): React.JSX.Element {
  const page = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Pedidos"
        description="Pedidos reais da loja, com preços server-side e integração transacional com estoque."
      />
      <OrdersList initialPage={page} />
    </div>
  );
}
