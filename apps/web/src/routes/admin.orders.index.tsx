import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
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
  pendingComponent: () => (
    <EmptyState title="Carregando pedidos" description="Buscando os pedidos da sua loja." />
  ),
  errorComponent: ({ error }) => (
    <EmptyState
      title="Não foi possível carregar os pedidos"
      description={error instanceof Error ? error.message : "Tente novamente em instantes."}
    />
  ),
  component: OrdersPage,
});

function OrdersPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Veja quem comprou, acompanhe cada pedido e cuide do que precisa ser atendido."
      />
      <OrdersList initialPage={data.orders} products={data.products.items} />
    </>
  );
}
