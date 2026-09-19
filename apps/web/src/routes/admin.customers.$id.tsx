import { Link, createFileRoute } from "@tanstack/react-router";
import type { CustomerDetail } from "@white-label/customers";
import { formatOrderNumber } from "@white-label/orders";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CustomerEditForm } from "../features/store-admin/customer-edit-form.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { getMerchantCustomer } from "../lib/server/operations-customers.functions.ts";

export const Route = createFileRoute("/admin/customers/$id")({
  loader: async ({ params }) => {
    const customer = await getMerchantCustomer({ data: { id: params.id } });
    if (!customer) throw new Error("Cliente não encontrado");
    return customer;
  },
  component: CustomerDetailPage,
});

function CustomerOrders({
  customer,
}: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  return (
    <section className="k-document-section">
      <header className="k-document-section__head">
        <div>
          <span className="k-section-kicker">Histórico</span>
          <h2>Pedidos</h2>
        </div>
        <span>{customer.orders.length} registro(s)</span>
      </header>
      {!customer.orders.length ? (
        <div className="k-inline-state">Nenhum pedido relacionado.</div>
      ) : (
        <div className="k-table-wrap k-table-wrap--flush">
          <table className="k-table">
            <thead>
              <tr><th>Pedido</th><th>Status</th><th>Pagamento</th><th>Itens</th><th className="k-align-right">Total</th><th>Data</th><th aria-label="Ações" /></tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{formatOrderNumber(order.orderNumber)}</strong></td>
                  <td><span className={`k-status-pill k-status-pill--${order.status}`}>{order.status}</span></td>
                  <td>{order.paymentStatus}</td>
                  <td>{order.itemSummary ?? `${String(order.itemCount)} item(ns)`}</td>
                  <td className="k-align-right k-money">{formatMoney(order.totalCents)}</td>
                  <td>{new Date(order.createdAt).toLocaleString("pt-BR")}</td>
                  <td><Link className="k-text-action" to="/admin/orders/$id" params={{ id: order.id }}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CustomerSidebar({
  customer,
}: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  return (
    <aside className="k-document-aside">
      <section>
        <span className="k-section-kicker">Resumo</span>
        <dl className="k-profile-stats">
          <div><dt>Pedidos</dt><dd>{customer.totalOrders}</dd></div>
          <div><dt>Total gasto</dt><dd>{formatMoney(customer.totalSpentCents)}</dd></div>
          <div><dt>Último pedido</dt><dd>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("pt-BR") : "—"}</dd></div>
        </dl>
      </section>
      <section>
        <span className="k-section-kicker">Contato</span>
        <h2>Identificação</h2>
        <dl className="k-detail-list">
          <div><dt>Telefone</dt><dd>{customer.phone ?? "Não informado"}</dd></div>
          <div><dt>E-mail</dt><dd>{customer.email ?? "Não informado"}</dd></div>
          <div><dt>Documento</dt><dd>{customer.document ?? "Não informado"}</dd></div>
          <div><dt>Cadastro</dt><dd>{new Date(customer.createdAt).toLocaleDateString("pt-BR")}</dd></div>
        </dl>
      </section>
    </aside>
  );
}

function CustomerDetailPage(): React.JSX.Element {
  const customer = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title={customer.name}
        description="Cadastro, relacionamento e histórico de pedidos em uma única ficha."
      />
      <div className="k-document-layout">
        <main className="k-document-main">
          <CustomerEditForm customer={customer} />
          <CustomerOrders customer={customer} />
        </main>
        <CustomerSidebar customer={customer} />
      </div>
    </div>
  );
}
