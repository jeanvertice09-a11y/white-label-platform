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
    <div className="k-table-wrap k-table-wrap--flush">
      <table className="k-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Contato</th>
            <th className="k-align-right">Pedidos</th>
            <th className="k-align-right">Total gasto</th>
            <th>Último pedido</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((customer) => (
            <tr key={customer.id}>
              <td>
                <strong className="k-row__title">{customer.name}</strong>
                <div className="k-row__meta">
                  Cliente desde {new Date(customer.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </td>
              <td>
                {customer.phone ?? customer.email ?? "Não informado"}
                {customer.phone && customer.email ? <div className="k-row__meta">{customer.email}</div> : null}
              </td>
              <td className="k-align-right">{customer.totalOrders}</td>
              <td className="k-align-right k-money">{formatMoney(customer.totalSpentCents)}</td>
              <td>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleString("pt-BR") : "—"}</td>
              <td className="k-align-right">
                <Link className="k-text-action" to="/admin/customers/$id" params={{ id: customer.id }}>
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
    <div className="k-pagination">
      <span>{props.data.total} cliente(s) · página {props.data.page} de {pages}</span>
      <div>
        <button className="k-button" type="button" disabled={props.loading || props.data.page <= 1} onClick={() => { void props.load(props.data.page - 1); }}>Anterior</button>
        <button className="k-button" type="button" disabled={props.loading || props.data.page >= pages} onClick={() => { void props.load(props.data.page + 1); }}>Próxima</button>
      </div>
    </div>
  );
}

function CustomerToolbar(props: Readonly<{
  search: string;
  loading: boolean;
  setSearch: (value: string) => void;
  load: LoadPage;
}>): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void props.load(1);
  }
  return (
    <form className="k-toolbar" onSubmit={submit}>
      <div className="k-toolbar__search">
        <label className="k-visually-hidden" htmlFor="customer-search">Buscar clientes</label>
        <input
          id="customer-search"
          value={props.search}
          onChange={(event) => { props.setSearch(event.target.value); }}
          placeholder="Nome, telefone, e-mail ou documento"
        />
      </div>
      <button className="k-button k-button--primary" disabled={props.loading} type="submit">
        Buscar
      </button>
      {props.search ? (
        <button className="k-button k-button--ghost" type="button" disabled={props.loading} onClick={() => { void props.load(1, true); }}>
          Limpar
        </button>
      ) : null}
    </form>
  );
}

export function CustomersList({ initialPage }: Readonly<{
  initialPage: CustomerPage;
}>): React.JSX.Element {
  const [data, setData] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(page: number, clear = false): Promise<void> {
    setLoading(true);
    setError("");
    if (clear) setSearch("");
    try {
      setData(await listMerchantCustomers({
        data: {
          page,
          pageSize: PAGE_SIZE,
          search: clear ? undefined : search.trim() || undefined,
        },
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">CRM</span>
          <h2>Base de clientes</h2>
          <p>Contato, recorrência e histórico financeiro em uma visão operacional.</p>
        </div>
        <span className="k-section-count">{data.total} cliente(s)</span>
      </header>
      <CustomerToolbar search={search} loading={loading} setSearch={setSearch} load={load} />
      {loading ? <div className="k-inline-state">Atualizando clientes…</div> : null}
      {error ? <div className="k-inline-state k-inline-state--error">{error}</div> : null}
      {!error && !loading && data.items.length === 0 ? (
        <div className="k-inline-state">
          <strong>Nenhum cliente encontrado</strong>
          <span>Cadastre um cliente ou ajuste a busca.</span>
        </div>
      ) : null}
      {!error && data.items.length > 0 ? <CustomerTable data={data} /> : null}
      {!error && data.total > 0 ? <Pagination data={data} loading={loading} load={load} /> : null}
    </section>
  );
}
