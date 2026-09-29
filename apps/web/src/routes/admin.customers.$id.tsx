import { Link, createFileRoute } from "@tanstack/react-router";
import type { CustomerDetail } from "@white-label/customers";
import { formatOrderNumber } from "@white-label/orders";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CustomerEditForm } from "../features/store-admin/customer-edit-form.tsx";
import { CustomerInsightsPanel } from "../features/store-admin/customer-insights-panel.tsx";
import { formatMoney, pluralize, statusLabel } from "../features/store-admin/format.ts";
import { getMerchantCustomer } from "../lib/server/operations-customers.functions.ts";
import { getMerchantCustomerInsights } from "../lib/server/customer-insights.functions.ts";
import type { MerchantCustomerInsights } from "../lib/server/customer-insights.functions.ts";

const EMPTY_INSIGHTS: MerchantCustomerInsights = { completedOrders: 0, totalSpentCents: 0, averageTicketCents: 0, firstPurchaseAt: null, lastPurchaseAt: null, recencyDays: null, averageDaysBetweenPurchases: null, products: [] };
const EMPTY_VALUE = "Não informado";

export const Route = createFileRoute("/admin/customers/$id")({
  loader: async ({ params }) => {
    const customer = await getMerchantCustomer({ data: { id: params.id } });
    if (!customer) throw new Error("Cliente não encontrado");
    const insights = await getMerchantCustomerInsights({ data: { id: params.id } }).catch(() => EMPTY_INSIGHTS);
    return { customer, insights };
  },
  component: CustomerDetailPage,
});

function OrderField({ label, value, className }: Readonly<{ label: string; value: React.ReactNode; className?: string }>): React.JSX.Element {
  return <div className={className}><span>{label}</span><strong>{value}</strong></div>;
}

function CustomerOrders({ customer }: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  return <section className="k-customer-history">
    <header className="k-customer-history__head"><div><span className="k-section-kicker">Histórico</span><h2>Pedidos</h2></div><span>{pluralize(customer.orders.length, "registro", "registros")}</span></header>
    {!customer.orders.length ? <div className="k-inline-state">Nenhum pedido relacionado.</div> : <div className="k-customer-order-list">{customer.orders.map((order) => <article className="k-customer-order" key={order.id}>
      <div className="k-customer-order__primary"><Link to="/admin/orders/$id" params={{ id: order.id }}>{formatOrderNumber(order.orderNumber)}</Link><span className={`k-status-pill k-status-pill--${order.status}`}>{statusLabel(order.status)}</span></div>
      <OrderField className="k-customer-order__item" label="Itens" value={order.itemSummary ?? pluralize(order.itemCount, "item", "itens")} />
      <OrderField className="k-customer-order__meta" label="Pagamento" value={statusLabel(order.paymentStatus)} />
      <OrderField className="k-customer-order__meta" label="Data" value={new Date(order.createdAt).toLocaleDateString("pt-BR")} />
      <OrderField className="k-customer-order__total" label="Total" value={formatMoney(order.totalCents)} />
      <Link className="k-text-action" to="/admin/orders/$id" params={{ id: order.id }}>Ver pedido</Link>
    </article>)}</div>}
  </section>;
}

function CustomerSidebar({ customer }: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  return <aside className="k-document-aside">
    <section><span className="k-section-kicker">Resumo</span><dl className="k-profile-stats"><div><dt>Pedidos</dt><dd>{customer.totalOrders}</dd></div><div><dt>Total gasto</dt><dd>{formatMoney(customer.totalSpentCents)}</dd></div><div><dt>Último pedido</dt><dd>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("pt-BR") : EMPTY_VALUE}</dd></div></dl></section>
    <section><span className="k-section-kicker">Contato</span><h2>Identificação</h2><dl className="k-detail-list"><div><dt>Telefone</dt><dd>{customer.phone ?? EMPTY_VALUE}</dd></div><div><dt>E-mail</dt><dd>{customer.email ?? EMPTY_VALUE}</dd></div><div><dt>Documento</dt><dd>{customer.document ?? EMPTY_VALUE}</dd></div><div><dt>Cadastro</dt><dd>{new Date(customer.createdAt).toLocaleDateString("pt-BR")}</dd></div></dl></section>
  </aside>;
}

function CustomerDetailPage(): React.JSX.Element {
  const { customer, insights } = Route.useLoaderData();
  return <div className="k-page k-customer-detail">
    <PageHead title={customer.name} description="Cadastro, relacionamento, métricas reais e histórico de compras em uma única ficha." />
    <div className="k-document-layout"><main className="k-document-main"><CustomerEditForm customer={customer} /><CustomerInsightsPanel insights={insights} /><CustomerOrders customer={customer} /></main><CustomerSidebar customer={customer} /></div>
  </div>;
}
