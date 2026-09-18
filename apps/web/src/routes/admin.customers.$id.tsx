import { Link, createFileRoute } from "@tanstack/react-router";
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

function CustomerDetailPage(): React.JSX.Element {
  const customer = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title={customer.name}
        description="Dados reais, histórico de pedidos e métricas deste cliente."
      />
      <div className="k-grid">
        <div className="k-card">
          <div className="k-stat__label">Pedidos</div>
          <div className="k-stat__value">{customer.totalOrders}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Total gasto</div>
          <div className="k-stat__value">{formatMoney(customer.totalSpentCents)}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Último pedido</div>
          <div className="k-stat__value">
            {customer.lastOrderAt
              ? new Date(customer.lastOrderAt).toLocaleDateString("pt-BR")
              : "—"}
          </div>
        </div>
      </div>

      <CustomerEditForm customer={customer} />

      <div className="k-card">
        <h2>Identificação e contato</h2>
        <p>
          {customer.phone ?? "Telefone não informado"} ·{" "}
          {customer.email ?? "E-mail não informado"}
        </p>
        {customer.document
          ? <p className="k-muted">Documento: {customer.document}</p>
          : null}
        <p className="k-muted">
          Cadastrado em {new Date(customer.createdAt).toLocaleString("pt-BR")}
        </p>
        {customer.notes ? <p className="k-muted">{customer.notes}</p> : null}
      </div>

      <div className="k-card k-table-wrap">
        <h2>Histórico de pedidos</h2>
        {customer.orders.length ? (
          <table className="k-table">
            <thead>
              <tr>
                <th>Pedido</th><th>Status</th><th>Pagamento</th>
                <th>Itens</th><th>Total</th><th>Data</th><th />
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{formatOrderNumber(order.orderNumber)}</strong></td>
                  <td>{order.status}</td>
                  <td>{order.paymentStatus}</td>
                  <td>
                    {order.itemSummary ?? `${order.itemCount} item(ns)`}
                  </td>
                  <td>{formatMoney(order.totalCents)}</td>
                  <td>{new Date(order.createdAt).toLocaleString("pt-BR")}</td>
                  <td>
                    <Link
                      className="k-button"
                      to="/admin/orders/$id"
                      params={{ id: order.id }}
                    >
                      Abrir pedido
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="k-empty">Nenhum pedido relacionado.</div>}
      </div>
    </div>
  );
}
