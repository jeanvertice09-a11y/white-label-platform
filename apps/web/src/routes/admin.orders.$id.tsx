import { createFileRoute } from "@tanstack/react-router";
import { formatOrderNumber } from "@white-label/orders";
import type { OrderTimelineEntry } from "@white-label/orders";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OrderActions } from "../features/store-admin/order-actions.tsx";
import { getMerchantOrderDetail } from "../lib/server/operations-orders.functions.ts";

export const Route = createFileRoute("/admin/orders/$id")({
  loader: async ({ params }) => {
    const detail = await getMerchantOrderDetail({ data: { id: params.id } });
    if (!detail) throw new Error("Pedido não encontrado");
    return detail;
  },
  component: OrderDetailPage,
});

function eventLabel(event: OrderTimelineEntry): string {
  if (event.action === "order.created") return "Pedido criado";
  if (event.action === "order.status_changed") return "Status alterado";
  if (event.action === "order.cancelled") return "Pedido cancelado";
  if (event.action === "order.stock_consumed") return "Estoque consumido";
  if (event.action === "order.stock_restored") return "Estoque restaurado";
  return event.action;
}

function Timeline(
  { items }: Readonly<{ items: OrderTimelineEntry[] }>,
): React.JSX.Element {
  if (items.length === 0) {
    return <div className="k-empty">Sem eventos de auditoria para este pedido.</div>;
  }
  return (
    <div className="k-card">
      <h2>Histórico</h2>
      <div className="k-stack">
        {items.map((event) => (
          <div className="k-row" key={event.id}>
            <div>
              <strong>{eventLabel(event)}</strong>
              <div className="k-row__meta">
                {new Date(event.createdAt).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderDetailPage(): React.JSX.Element {
  const { order, timeline } = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title={"Pedido " + formatOrderNumber(order.orderNumber)}
        description={"Origem " + order.origin + " · status " + order.status}
        action={<OrderActions orderId={order.id} status={order.status} />}
      />
      <div className="k-grid">
        <div className="k-card">
          <div className="k-stat__label">Subtotal</div>
          <div className="k-stat__value">{formatMoney(order.subtotalCents)}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Desconto</div>
          <div className="k-stat__value">{formatMoney(order.discountCents)}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Frete</div>
          <div className="k-stat__value">{formatMoney(order.shippingCents)}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Total</div>
          <div className="k-stat__value">{formatMoney(order.totalCents)}</div>
        </div>
      </div>
      <div className="k-card">
        <h2>Cliente</h2>
        <p>
          {order.customerName ?? "Nome não informado"} ·{" "}
          {order.customerPhone ?? "Telefone não informado"}
        </p>
        {order.couponCodeSnapshot ? (
          <p className="k-muted">Cupom: {order.couponCodeSnapshot}</p>
        ) : null}
        {order.notes ? <p className="k-muted">Observação: {order.notes}</p> : null}
      </div>
      <div className="k-card k-table-wrap">
        <h2>Itens</h2>
        <table className="k-table">
          <thead>
            <tr>
              <th>Produto / variante</th>
              <th>SKU</th>
              <th>Qtd.</th>
              <th>Unitário</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.productName}
                  {item.variantName ? " — " + item.variantName : ""}
                </td>
                <td>{item.skuSnapshot ?? "—"}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitCents)}</td>
                <td>{formatMoney(item.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Timeline items={timeline} />
    </div>
  );
}
