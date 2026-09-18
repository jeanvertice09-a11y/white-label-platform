import { createFileRoute } from "@tanstack/react-router";
import { formatOrderNumber } from "@white-label/orders";
import type { Order, OrderTimelineEntry } from "@white-label/orders";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OrderActions } from "../features/store-admin/order-actions.tsx";
import { getMerchantOrderDetail } from "../lib/server/operations-orders.functions.ts";

interface OrderDetailData {
  order: Order;
  timeline: OrderTimelineEntry[];
}

async function loadDetail(id: string): Promise<OrderDetailData> {
  const detail = await getMerchantOrderDetail({ data: { id } });
  if (!detail) throw new Error("Pedido não encontrado");
  return detail;
}

export const Route = createFileRoute("/admin/orders/$id")({
  loader: ({ params }) => loadDetail(params.id),
  component: OrderDetailPage,
});

function eventLabel(action: string): string {
  if (action === "order.created") return "Pedido criado";
  if (action === "order.status_changed") return "Status alterado";
  if (action === "order.cancelled") return "Pedido cancelado";
  if (action === "order.stock_consumed") return "Estoque consumido";
  if (action === "order.stock_restored") return "Estoque restaurado";
  return action;
}

function Timeline({ items }: Readonly<{ items: OrderTimelineEntry[] }>): React.JSX.Element {
  if (items.length === 0) return <div className="k-empty">Sem eventos de auditoria para este pedido.</div>;
  return (
    <div className="k-card">
      <h2>Histórico</h2>
      <div className="k-stack">
        {items.map((event) => (
          <div className="k-row" key={event.id}>
            <div><strong>{eventLabel(event.action)}</strong><div className="k-row__meta">{new Date(event.createdAt).toLocaleString("pt-BR")}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ order }: Readonly<{ order: Order }>): React.JSX.Element {
  const values = [
    ["Subtotal", order.subtotalCents], ["Desconto", order.discountCents],
    ["Frete", order.shippingCents], ["Total", order.totalCents],
  ] as const;
  return <div className="k-grid">{values.map(([label, cents]) => <div className="k-card" key={label}><div className="k-stat__label">{label}</div><div className="k-stat__value">{formatMoney(cents)}</div></div>)}</div>;
}

function Customer({ order }: Readonly<{ order: Order }>): React.JSX.Element {
  return (
    <div className="k-card">
      <h2>Cliente</h2>
      <p>{order.customerName ?? "Nome não informado"} · {order.customerPhone ?? "Telefone não informado"}</p>
      {order.couponCodeSnapshot ? <p className="k-muted">Cupom: {order.couponCodeSnapshot}</p> : null}
      {order.notes ? <p className="k-muted">Observação: {order.notes}</p> : null}
    </div>
  );
}

function Items({ order }: Readonly<{ order: Order }>): React.JSX.Element {
  return (
    <div className="k-card k-table-wrap">
      <h2>Itens</h2>
      <table className="k-table">
        <thead><tr><th>Produto / variante</th><th>SKU</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead>
        <tbody>{order.items.map((item) => <tr key={item.id}><td>{item.productName}{item.variantName ? " — " + item.variantName : ""}</td><td>{item.skuSnapshot ?? "—"}</td><td>{item.quantity}</td><td>{formatMoney(item.unitCents)}</td><td>{formatMoney(item.totalCents)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function OrderDetailPage(): React.JSX.Element {
  const { order, timeline } = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title={"Pedido " + formatOrderNumber(order.orderNumber)} description={"Origem " + order.origin + " · status " + order.status} action={<OrderActions orderId={order.id} status={order.status} />} />
      <Summary order={order} />
      <Customer order={order} />
      <Items order={order} />
      <Timeline items={timeline} />
    </div>
  );
}
