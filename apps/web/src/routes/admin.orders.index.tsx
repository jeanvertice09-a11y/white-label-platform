import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { OrdersList } from "../features/store-admin/orders-list.tsx";
import { listMerchantOrders } from "../lib/server/operations-orders.functions.ts";

export const Route = createFileRoute("/admin/orders/")({
  loader: () => listMerchantOrders(),
  component: OrdersPage,
});

function OrdersPage(): React.JSX.Element {
  const orders = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title="Pedidos" description="Pedidos reais da loja, com valores preservados em snapshot." />
      <OrdersList orders={orders} />
    </div>
  );
}
