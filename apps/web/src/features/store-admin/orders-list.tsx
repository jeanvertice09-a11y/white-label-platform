import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatOrderNumber } from "@white-label/orders";
import type { Order, OrderStatus } from "@white-label/orders";
import { formatMoney } from "./format.ts";

const statuses: Array<"" | OrderStatus> = [
  "",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export function OrdersList({ orders }: Readonly<{ orders: Order[] }>): React.JSX.Element {
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [customer, setCustomer] = useState("");
  const [date, setDate] = useState("");
  const filtered = useMemo(() => {
    const term = customer.trim().toLocaleLowerCase("pt-BR");
    return orders.filter((order) => {
      const matchesStatus = !status || order.status === status;
      const matchesCustomer = !term || (order.customerName ?? "").toLocaleLowerCase("pt-BR").includes(term)
        || (order.customerPhone ?? "").includes(term);
      const matchesDate = !date || order.createdAt.slice(0, 10) === date;
      return matchesStatus && matchesCustomer && matchesDate;
    });
  }, [customer, date, orders, status]);

  return (
    <div className="k-stack">
      <div className="k-card k-form__grid">
        <div className="k-field"><label htmlFor="order-status">Status</label><select id="order-status" value={status} onChange={(event) => { setStatus(event.target.value as "" | OrderStatus); }}>{statuses.map((value) => <option key={value || "all"} value={value}>{value || "Todos"}</option>)}</select></div>
        <div className="k-field"><label htmlFor="order-customer">Cliente</label><input id="order-customer" value={customer} onChange={(event) => { setCustomer(event.target.value); }} placeholder="Nome ou telefone" /></div>
        <div className="k-field"><label htmlFor="order-date">Data</label><input id="order-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); }} /></div>
      </div>
      {filtered.length ? (
        <div className="k-card k-table-wrap">
          <table className="k-table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Origem</th><th>Status</th><th>Total</th><th /></tr></thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td><strong>{formatOrderNumber(order.orderNumber)}</strong><div className="k-row__meta">{new Date(order.createdAt).toLocaleString("pt-BR")}</div></td>
                  <td>{order.customerName ?? order.customerPhone ?? "Não informado"}</td>
                  <td>{order.origin}</td>
                  <td><span className="k-badge">{order.status}</span></td>
                  <td>{formatMoney(order.totalCents)}</td>
                  <td><Link className="k-button" to="/admin/orders/$id" params={{ id: order.id }}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="k-empty">Nenhum pedido encontrado com estes filtros.</div>}
    </div>
  );
}
