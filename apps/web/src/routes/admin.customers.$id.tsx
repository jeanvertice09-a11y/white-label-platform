import { Link, createFileRoute } from "@tanstack/react-router";
import type { CustomerDetail } from "@white-label/customers";
import { formatOrderNumber } from "@white-label/orders";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { Section } from "../admin/ui/Section.tsx";
import { StatusDot } from "../admin/ui/StatusDot.tsx";
import styles from "../admin/ui/Section.module.css";
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

function OrderField({ label, value }: Readonly<{ label: string; value: React.ReactNode }>): React.JSX.Element {
  return <div className={styles.orderField}><span>{label}</span><strong>{value}</strong></div>;
}

function CustomerOrders({ customer }: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  return (
    <Section title="Pedidos" description="Histórico de compras do cliente" action={<span className={styles.muted}>{pluralize(customer.orders.length, "registro", "registros")}</span>}>
      {!customer.orders.length ? (
        <div className={styles.empty}>Nenhum pedido relacionado.</div>
      ) : (
        <div className={styles.orderList}>
          {customer.orders.map((order) => (
            <article className={styles.order} key={order.id}>
              <div className={styles.orderPrimary}>
                <Link className={styles.strongLink} to="/admin/orders/$id" params={{ id: order.id }}>{formatOrderNumber(order.orderNumber)}</Link>
                <StatusDot label={statusLabel(order.status)} />
              </div>
              <OrderField label="Itens" value={order.itemSummary ?? pluralize(order.itemCount, "item", "itens")} />
              <OrderField label="Pagamento" value={statusLabel(order.paymentStatus)} />
              <OrderField label="Data" value={new Date(order.createdAt).toLocaleDateString("pt-BR")} />
              <OrderField label="Total" value={formatMoney(order.totalCents)} />
              <Link className={styles.actionLink} to="/admin/orders/$id" params={{ id: order.id }}>Ver pedido</Link>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

function DetailList({ items }: Readonly<{ items: readonly { label: string; value: React.ReactNode }[] }>): React.JSX.Element {
  return <dl className={styles.detailList}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

function CustomerSidebar({ customer }: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  return (
    <aside className={styles.aside}>
      <Section title="Resumo">
        <DetailList items={[
          { label: "Pedidos", value: customer.totalOrders },
          { label: "Total gasto", value: formatMoney(customer.totalSpentCents) },
          { label: "Último pedido", value: customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("pt-BR") : EMPTY_VALUE },
        ]} />
      </Section>
      <Section title="Identificação" description="Contato e cadastro">
        <DetailList items={[
          { label: "Telefone", value: customer.phone ?? EMPTY_VALUE },
          { label: "E-mail", value: customer.email ?? EMPTY_VALUE },
          { label: "Documento", value: customer.document ?? EMPTY_VALUE },
          { label: "Cadastro", value: new Date(customer.createdAt).toLocaleDateString("pt-BR") },
        ]} />
      </Section>
    </aside>
  );
}

function CustomerDetailPage(): React.JSX.Element {
  const { customer, insights } = Route.useLoaderData();
  return (
    <div className={styles.page}>
      <PageHeader title={customer.name} description="Cadastro, relacionamento, métricas reais e histórico de compras em uma única ficha." />
      <div className={styles.documentLayout}>
        <main className={styles.documentMain}>
          <CustomerEditForm customer={customer} />
          <CustomerInsightsPanel insights={insights} />
          <CustomerOrders customer={customer} />
        </main>
        <CustomerSidebar customer={customer} />
      </div>
    </div>
  );
}
