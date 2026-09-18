import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Link } from "@tanstack/react-router";
import { formatOrderNumber } from "@white-label/orders";
import type { OrderPage, OrderStatus } from "@white-label/orders";
import { listMerchantOrders } from "../../lib/server/operations-orders.functions.ts";
import { formatMoney } from "./format.ts";

const PAGE_SIZE = 20;
const statuses: Array<"" | OrderStatus> = [
  "", "pending", "confirmed", "preparing", "ready", "completed", "cancelled",
];
type LoadPage = (page: number, clear?: boolean) => Promise<void>;

interface FiltersProps {
  search: string;
  status: "" | OrderStatus;
  date: string;
  loading: boolean;
  setSearch: (value: string) => void;
  setStatus: (value: "" | OrderStatus) => void;
  setDate: (value: string) => void;
  load: LoadPage;
}

function FilterFields(props: Readonly<FiltersProps>): React.JSX.Element {
  return (
    <div className="k-form__grid">
      <div className="k-field"><label htmlFor="orders-search">Buscar</label><input id="orders-search" value={props.search} onChange={(event) => { props.setSearch(event.target.value); }} placeholder="Pedido, cliente ou telefone" /></div>
      <div className="k-field"><label htmlFor="orders-status">Status</label><select id="orders-status" value={props.status} onChange={(event) => { props.setStatus(event.target.value as "" | OrderStatus); }}>{statuses.map((value) => <option key={value || "all"} value={value}>{value || "Todos"}</option>)}</select></div>
      <div className="k-field"><label htmlFor="orders-date">Data</label><input id="orders-date" type="date" value={props.date} onChange={(event) => { props.setDate(event.target.value); }} /></div>
    </div>
  );
}

function OrdersFilters(props: Readonly<FiltersProps>): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void props.load(1);
  }
  return (
    <form className="k-card k-form" onSubmit={submit}>
      <FilterFields {...props} />
      <div className="k-actions">
        <button className="k-button k-button--primary" disabled={props.loading} type="submit">Buscar</button>
        <button className="k-button" disabled={props.loading} type="button" onClick={() => { void props.load(1, true); }}>Limpar</button>
        {props.loading ? <span className="k-status">Carregando…</span> : null}
      </div>
    </form>
  );
}

function OrdersTable({ data }: Readonly<{ data: OrderPage }>): React.JSX.Element {
  return (
    <div className="k-card k-table-wrap">
      <table className="k-table">
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Origem</th><th>Status</th><th>Total</th><th /></tr></thead>
        <tbody>{data.items.map((order) => (
          <tr key={order.id}>
            <td><strong>{formatOrderNumber(order.orderNumber)}</strong><div className="k-row__meta">{new Date(order.createdAt).toLocaleString("pt-BR")}</div></td>
            <td>{order.customerName ?? order.customerPhone ?? "Não informado"}</td>
            <td>{order.origin}</td><td><span className="k-badge">{order.status}</span></td><td>{formatMoney(order.totalCents)}</td>
            <td><Link className="k-button" to="/admin/orders/$id" params={{ id: order.id }}>Abrir</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function OrdersPagination(props: Readonly<{ data: OrderPage; loading: boolean; load: LoadPage }>): React.JSX.Element {
  const pages = Math.max(1, Math.ceil(props.data.total / props.data.pageSize));
  return (
    <div className="k-actions">
      <button className="k-button" type="button" disabled={props.loading || props.data.page <= 1} onClick={() => { void props.load(props.data.page - 1); }}>Anterior</button>
      <span className="k-status">Página {props.data.page} de {pages} · {props.data.total} pedido(s)</span>
      <button className="k-button" type="button" disabled={props.loading || props.data.page >= pages} onClick={() => { void props.load(props.data.page + 1); }}>Próxima</button>
    </div>
  );
}

export function OrdersList({ initialPage }: Readonly<{ initialPage: OrderPage }>): React.JSX.Element {
  const [data, setData] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(page: number, clear = false): Promise<void> {
    setLoading(true); setError("");
    if (clear) { setSearch(""); setStatus(""); setDate(""); }
    try {
      const result = await listMerchantOrders({ data: {
        page, pageSize: PAGE_SIZE,
        search: clear ? undefined : search.trim() || undefined,
        status: clear || !status ? undefined : status,
        date: clear || !date ? undefined : date,
      } });
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os pedidos.");
    } finally { setLoading(false); }
  }
  const filters = { search, status, date, loading, setSearch, setStatus, setDate, load };
  return (
    <div className="k-stack">
      <OrdersFilters {...filters} />
      {error ? <div className="k-empty">{error}</div> : null}
      {!error && !loading && data.items.length === 0 ? <div className="k-empty">Nenhum pedido encontrado com estes filtros.</div> : null}
      {!error && data.items.length > 0 ? <OrdersTable data={data} /> : null}
      {!error && data.total > 0 ? <OrdersPagination data={data} loading={loading} load={load} /> : null}
    </div>
  );
}
