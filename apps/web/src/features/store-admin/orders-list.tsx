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

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    preparing: "Em preparo",
    ready: "Pronto",
    completed: "Concluído",
    cancelled: "Cancelado",
  };
  return labels[status];
}

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

function OrdersToolbar(props: Readonly<FiltersProps>): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void props.load(1);
  }
  return (
    <form className="k-toolbar" onSubmit={submit}>
      <div className="k-toolbar__search">
        <label className="k-visually-hidden" htmlFor="orders-search">Buscar pedidos</label>
        <input
          id="orders-search"
          value={props.search}
          onChange={(event) => { props.setSearch(event.target.value); }}
          placeholder="Pedido, cliente ou telefone"
        />
      </div>
      <label className="k-toolbar__select">
        <span>Status</span>
        <select
          value={props.status}
          onChange={(event) => { props.setStatus(event.target.value as "" | OrderStatus); }}
        >
          {statuses.map((value) => (
            <option key={value || "all"} value={value}>
              {value ? statusLabel(value) : "Todos"}
            </option>
          ))}
        </select>
      </label>
      <label className="k-toolbar__select">
        <span>Data</span>
        <input
          type="date"
          value={props.date}
          onChange={(event) => { props.setDate(event.target.value); }}
        />
      </label>
      <button className="k-button k-button--primary" disabled={props.loading} type="submit">
        Filtrar
      </button>
      {props.search || props.status || props.date ? (
        <button
          className="k-button k-button--ghost"
          disabled={props.loading}
          type="button"
          onClick={() => { void props.load(1, true); }}
        >
          Limpar
        </button>
      ) : null}
    </form>
  );
}

function OrdersTable({ data }: Readonly<{ data: OrderPage }>): React.JSX.Element {
  return (
    <div className="k-table-wrap k-table-wrap--flush">
      <table className="k-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Origem</th>
            <th>Status</th>
            <th className="k-align-right">Total</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((order) => (
            <tr key={order.id}>
              <td>
                <strong className="k-row__title">{formatOrderNumber(order.orderNumber)}</strong>
                <div className="k-row__meta">{new Date(order.createdAt).toLocaleString("pt-BR")}</div>
              </td>
              <td>{order.customerName ?? order.customerPhone ?? "Não informado"}</td>
              <td className="k-muted">{order.origin}</td>
              <td>
                <span className={`k-status-pill k-status-pill--${order.status}`}>
                  {statusLabel(order.status)}
                </span>
              </td>
              <td className="k-align-right k-money">{formatMoney(order.totalCents)}</td>
              <td className="k-align-right">
                <Link className="k-text-action" to="/admin/orders/$id" params={{ id: order.id }}>
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersPagination(props: Readonly<{
  data: OrderPage;
  loading: boolean;
  load: LoadPage;
}>): React.JSX.Element {
  const pages = Math.max(1, Math.ceil(props.data.total / props.data.pageSize));
  return (
    <div className="k-pagination">
      <span>{props.data.total} pedido(s) · página {props.data.page} de {pages}</span>
      <div>
        <button className="k-button" type="button" disabled={props.loading || props.data.page <= 1} onClick={() => { void props.load(props.data.page - 1); }}>Anterior</button>
        <button className="k-button" type="button" disabled={props.loading || props.data.page >= pages} onClick={() => { void props.load(props.data.page + 1); }}>Próxima</button>
      </div>
    </div>
  );
}

function useOrdersList(initialPage: OrderPage): Readonly<{
  data: OrderPage;
  search: string;
  status: "" | OrderStatus;
  date: string;
  loading: boolean;
  error: string;
  setSearch: (value: string) => void;
  setStatus: (value: "" | OrderStatus) => void;
  setDate: (value: string) => void;
  load: LoadPage;
}> {
  const [data, setData] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(page: number, clear = false): Promise<void> {
    setLoading(true);
    setError("");
    if (clear) {
      setSearch("");
      setStatus("");
      setDate("");
    }
    try {
      const result = await listMerchantOrders({
        data: {
          page,
          pageSize: PAGE_SIZE,
          search: clear ? undefined : search.trim() || undefined,
          status: clear || !status ? undefined : status,
          date: clear || !date ? undefined : date,
        },
      });
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  return { data, search, status, date, loading, error, setSearch, setStatus, setDate, load };
}

export function OrdersList({ initialPage }: Readonly<{
  initialPage: OrderPage;
}>): React.JSX.Element {
  const state = useOrdersList(initialPage);
  const filters = {
    search: state.search,
    status: state.status,
    date: state.date,
    loading: state.loading,
    setSearch: state.setSearch,
    setStatus: state.setStatus,
    setDate: state.setDate,
    load: state.load,
  };
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">Operação</span>
          <h2>Pedidos</h2>
          <p>Acompanhe os pedidos da loja e filtre o que precisa de ação.</p>
        </div>
        <span className="k-section-count">{state.data.total} registro(s)</span>
      </header>
      <OrdersToolbar {...filters} />
      {state.loading ? <div className="k-inline-state">Atualizando pedidos…</div> : null}
      {state.error ? (
        <div className="k-inline-state k-inline-state--error">
          <span>{state.error}</span>
          <button className="k-text-action" type="button" onClick={() => { void state.load(state.data.page); }}>Tentar novamente</button>
        </div>
      ) : null}
      {!state.error && !state.loading && state.data.items.length === 0 ? (
        <div className="k-inline-state">
          <strong>Nenhum pedido encontrado</strong>
          <span>Ajuste os filtros para consultar outro período.</span>
        </div>
      ) : null}
      {!state.error && state.data.items.length > 0 ? <OrdersTable data={state.data} /> : null}
      {!state.error && state.data.total > 0 ? <OrdersPagination data={state.data} loading={state.loading} load={state.load} /> : null}
    </section>
  );
}
