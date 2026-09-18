import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { CustomerPage } from "@white-label/customers";
import { listMerchantCustomers } from "../../lib/server/operations-customers.functions.ts";
import { formatMoney } from "./format.ts";

const PAGE_SIZE = 20;
type LoadPage = (page: number, clear?: boolean) => Promise<void>;

function CustomerTable({ data }: Readonly<{ data: CustomerPage }>): React.JSX.Element {
  return (
    <div className="k-card k-table-wrap">
      <table className="k-table">
        <thead>
          <tr>
            <th>Cliente</th><th>Contato</th><th>Pedidos</th>
            <th>Total gasto</th><th>Último pedido</th><th />
          </tr>
        </thead>
        <tbody>
          {data.items.map((customer) => (
            <tr key={customer.id}>
              <td>
                <strong>{customer.name}</strong>
                <div className="k-row__meta">
                  Desde {new Date(customer.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </td>
              <td>
                {customer.phone ?? customer.email ?? "Não informado"}
                {customer.phone && customer.email
                  ? <div className="k-row__meta">{customer.email}</div>
                  : null}
              </td>
              <td>{customer.totalOrders}</td>
              <td>{formatMoney(customer.totalSpentCents)}</td>
              <td>
                {customer.lastOrderAt
                  ? new Date(customer.lastOrderAt).toLocaleString("pt-BR")
                  : "—"}
              </td>
              <td>
                <Link
                  className="k-button"
                  to="/admin/customers/$id"
                  params={{ id: customer.id }}
                >
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

function Pagination(props: Readonly<{
  data: CustomerPage;
  loading: boolean;
  load: LoadPage;
}>): React.JSX.Element {
  const pages = Math.max(1, Math.ceil(props.data.total / props.data.pageSize));
  return (
    <div className="k-actions">
      <button
        className="k-button"
        type="button"
        disabled={props.loading || props.data.page <= 1}
        onClick={() => { void props.load(props.data.page - 1); }}
      >
        Anterior
      </button>
      <span className="k-status">
        Página {props.data.page} de {pages} · {props.data.total} cliente(s)
      </span>
      <button
        className="k-button"
        type="button"
        disabled={props.loading || props.data.page >= pages}
        onClick={() => { void props.load(props.data.page + 1); }}
      >
        Próxima
      </button>
    </div>
  );
}

export function CustomersList({
  initialPage,
}: Readonly<{ initialPage: CustomerPage }>): React.JSX.Element {
  const [data, setData] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(page: number, clear = false): Promise<void> {
    setLoading(true);
    setError("");
    if (clear) setSearch("");
    try {
      const result = await listMerchantCustomers({
        data: {
          page,
          pageSize: PAGE_SIZE,
          search: clear ? undefined : search.trim() || undefined,
        },
      });
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : "Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void load(1);
  }

  return (
    <div className="k-stack">
      <form className="k-card k-form" onSubmit={submit}>
        <div className="k-field">
          <label htmlFor="customer-search">Buscar clientes</label>
          <input
            id="customer-search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); }}
            placeholder="Nome, telefone, e-mail ou documento"
          />
        </div>
        <div className="k-actions">
          <button className="k-button k-button--primary" disabled={loading}>
            Buscar
          </button>
          <button
            className="k-button"
            type="button"
            disabled={loading}
            onClick={() => { void load(1, true); }}
          >
            Limpar
          </button>
          {loading ? <span className="k-status">Carregando…</span> : null}
        </div>
      </form>
      {error ? <div className="k-empty">{error}</div> : null}
      {!error && !loading && data.items.length === 0
        ? <div className="k-empty">Nenhum cliente encontrado.</div>
        : null}
      {!error && data.items.length > 0 ? <CustomerTable data={data} /> : null}
      {!error && data.total > 0
        ? <Pagination data={data} loading={loading} load={load} />
        : null}
    </div>
  );
}
