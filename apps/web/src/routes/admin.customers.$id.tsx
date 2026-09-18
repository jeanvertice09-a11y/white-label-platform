import { createFileRoute } from "@tanstack/react-router";
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
      <PageHead title={customer.name} description="Resumo, dados e histórico de compras deste cliente." />
      <div className="k-grid">
        <div className="k-card"><div className="k-stat__label">Pedidos concluídos</div><div className="k-stat__value">{customer.orderCount}</div></div>
        <div className="k-card"><div className="k-stat__label">Total gasto</div><div className="k-stat__value">{formatMoney(customer.totalSpentCents)}</div></div>
        <div className="k-card"><div className="k-stat__label">Última compra</div><div className="k-stat__value">{customer.lastPurchaseAt ? new Date(customer.lastPurchaseAt).toLocaleDateString("pt-BR") : "—"}</div></div>
      </div>
      <CustomerEditForm customer={customer} />
      <div className="k-card">
        <h2>Contato</h2>
        <p>{customer.phone ?? "Telefone não informado"} · {customer.email ?? "E-mail não informado"}</p>
        {customer.document ? <p className="k-muted">Documento: {customer.document}</p> : null}
        {customer.notes ? <p className="k-muted">{customer.notes}</p> : null}
      </div>
      <div className="k-card k-table-wrap">
        <h2>Histórico</h2>
        {customer.orders.length ? (
          <table className="k-table">
            <thead><tr><th>Pedido</th><th>Status</th><th>Total</th><th>Data</th></tr></thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <td>#{String(order.orderNumber).padStart(8, "0")}</td>
                  <td>{order.status}</td>
                  <td>{formatMoney(order.totalCents)}</td>
                  <td>{new Date(order.createdAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="k-empty">Nenhum pedido relacionado.</div>}
      </div>
    </div>
  );
}
