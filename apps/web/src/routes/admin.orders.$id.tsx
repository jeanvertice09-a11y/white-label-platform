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
  payment: { paymentId:string; status:string; providerPaymentId:string|null; checkout:{expiresAt:string|null} } | null;
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

function Timeline({ items }: Readonly<{
  items: OrderTimelineEntry[];
}>): React.JSX.Element {
  return (
    <section className="k-document-section">
      <header className="k-document-section__head"><h2>Histórico</h2></header>
      {items.length === 0 ? (
        <div className="k-inline-state">Sem eventos de auditoria para este pedido.</div>
      ) : (
        <ol className="k-timeline-list">
          {items.map((event) => (
            <li key={event.id}>
              <span className="k-timeline-list__dot" aria-hidden="true" />
              <div>
                <strong>{eventLabel(event.action)}</strong>
                <span>{new Date(event.createdAt).toLocaleString("pt-BR")}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function OrderItems({ order }: Readonly<{ order: Order }>): React.JSX.Element {
  return (
    <section className="k-document-section">
      <header className="k-document-section__head">
        <h2>Itens do pedido</h2>
        <span>{order.items.length} item(ns)</span>
      </header>
      <div className="k-table-wrap k-table-wrap--flush">
        <table className="k-table">
          <thead>
            <tr><th>Produto / variante</th><th>SKU</th><th className="k-align-right">Qtd.</th><th className="k-align-right">Unitário</th><th className="k-align-right">Subtotal</th></tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.productName}</strong>{item.variantName ? <div className="k-row__meta">{item.variantName}</div> : null}</td>
                <td>{item.skuSnapshot ?? "—"}</td>
                <td className="k-align-right">{item.quantity}</td>
                <td className="k-align-right">{formatMoney(item.unitCents)}</td>
                <td className="k-align-right k-money">{formatMoney(item.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderSidebar({ order }: Readonly<{ order: Order }>): React.JSX.Element {
  return (
    <aside className="k-document-aside">
      <section>
        <span className="k-section-kicker">Cliente</span>
        <h2>{order.customerName ?? "Nome não informado"}</h2>
        <p>{order.customerPhone ?? "Telefone não informado"}</p>
        {order.notes ? <p className="k-muted">{order.notes}</p> : null}
      </section>
      <section>
        <span className="k-section-kicker">Resumo financeiro</span>
        <dl className="k-summary-list">
          <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>
          <div><dt>Desconto</dt><dd>{formatMoney(order.discountCents)}</dd></div>
          <div><dt>Frete</dt><dd>{formatMoney(order.shippingCents)}</dd></div>
          <div className="is-total"><dt>Total</dt><dd>{formatMoney(order.totalCents)}</dd></div>
        </dl>
        {order.couponCodeSnapshot ? <p className="k-muted">Cupom: {order.couponCodeSnapshot}</p> : null}
      </section>
    </aside>
  );
}

function OrderDetailPage(): React.JSX.Element {
  const { order, timeline, payment } = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title={`Pedido ${formatOrderNumber(order.orderNumber)}`}
        description={`${new Date(order.createdAt).toLocaleString("pt-BR")} · ${order.origin}`}
        action={<OrderActions orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} />}
      />
      <div className="k-document-meta">
        <span>Status</span>
        <strong>{order.status}</strong>
        <span>Pagamento</span><strong>{order.paymentStatus}</strong>
        {payment ? <><span>Gateway</span><strong>Mercado Pago · {payment.status}</strong></> : null}
      </div>
      <div className="k-document-layout">
        <main className="k-document-main">
          <OrderItems order={order} />
          <Timeline items={timeline} />
        </main>
        <OrderSidebar order={order} />
      </div>
    </div>
  );
}
