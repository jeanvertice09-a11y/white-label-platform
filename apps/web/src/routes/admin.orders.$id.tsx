import { createFileRoute } from "@tanstack/react-router";
import { formatOrderNumber } from "@white-label/orders";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OrderActions } from "../features/store-admin/order-actions.tsx";
import { getMerchantOrder } from "../lib/server/operations-orders.functions.ts";

export const Route = createFileRoute("/admin/orders/$id")({
  loader: async ({ params }) => {
    const order = await getMerchantOrder({ data: { id: params.id } });
    if (!order) throw new Error("Pedido não encontrado");
    return order;
  },
  component: OrderDetailPage,
});

function OrderDetailPage(): React.JSX.Element {
  const order = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title={"Pedido " + formatOrderNumber(order.orderNumber)}
        description={"Origem " + order.origin + " · status " + order.status}
        action={<OrderActions orderId={order.id} status={order.status} />}
      />
      <div className="k-grid">
        <div className="k-card"><div className="k-stat__label">Subtotal</div><div className="k-stat__value">{formatMoney(order.subtotalCents)}</div></div>
        <div className="k-card"><div className="k-stat__label">Desconto</div><div className="k-stat__value">{formatMoney(order.discountCents)}</div></div>
        <div className="k-card"><div className="k-stat__label">Total</div><div className="k-stat__value">{formatMoney(order.totalCents)}</div></div>
      </div>
      <div className="k-card">
        <h2>Cliente</h2>
        <p>{order.customerName ?? "Nome não informado"} · {order.customerPhone ?? "Telefone não informado"}</p>
        {order.couponCodeSnapshot ? <p className="k-muted">Cupom: {order.couponCodeSnapshot}</p> : null}
      </div>
      <div className="k-card k-table-wrap">
        <h2>Itens</h2>
        <table className="k-table">
          <thead><tr><th>Produto</th><th>SKU</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}{item.variantName ? " — " + item.variantName : ""}</td>
                <td>{item.skuSnapshot ?? "—"}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitCents)}</td>
                <td>{formatMoney(item.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
