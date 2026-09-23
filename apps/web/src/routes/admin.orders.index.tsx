import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { OrdersList } from "../features/store-admin/orders-list.tsx";
import { listMerchantOrders } from "../lib/server/operations-orders.functions.ts";
import { listMerchantProducts } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/orders/")({
  loader: async () => {
    const [orders, products] = await Promise.all([
      listMerchantOrders({ data: { page: 1, pageSize: 20 } }),
      listMerchantProducts({ data: { page: 1, pageSize: 48, sort: "name" } }),
    ]);
    return { orders, products };
  },
  pendingComponent: () => <div className="k-empty">Carregando pedidos…</div>,
  errorComponent: ({ error }) => (
    <div className="k-empty">
      {error instanceof Error ? error.message : "Não foi possível carregar os pedidos."}
    </div>
  ),
  component: OrdersPage,
});

function OrdersPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Pedidos"
        description="Pedidos reais da loja, com preços server-side e integração transacional com estoque."
      />
      <OrdersList initialPage={data.orders} products={data.products.items} />
    </div>
  );
}
