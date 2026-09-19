import { useState } from "react";
import type { SyntheticEvent } from "react";
import type {
  InventoryHistoryPage,
  InventoryPage,
  StockMovementType,
} from "@white-label/inventory";
import {
  listMerchantInventory,
  listMerchantInventoryHistory,
} from "../../lib/server/operations-inventory.functions.ts";
import { InventoryAdjustment } from "./inventory-adjustment.tsx";

const PAGE_SIZE = 20;
const MOVEMENT_TYPES: ReadonlyArray<{ value: StockMovementType; label: string }> = [
  { value: "initial", label: "Inicial" },
  { value: "purchase", label: "Entrada" },
  { value: "sale", label: "Venda" },
  { value: "adjustment", label: "Ajuste" },
  { value: "return", label: "Devolução" },
  { value: "cancellation", label: "Cancelamento" },
  { value: "manual", label: "Saída manual" },
];

function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function movementLabel(type: StockMovementType): string {
  return MOVEMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function Pager(props: Readonly<{
  page: number; pageSize: number; total: number; loading: boolean;
  onPage: (page: number) => Promise<void>;
}>): React.JSX.Element {
  const pages = totalPages(props.total, props.pageSize);
  return (
    <div className="k-pagination">
      <span>{props.total} registro(s) · página {props.page} de {pages}</span>
      <div>
        <button className="k-button" type="button" disabled={props.loading || props.page <= 1} onClick={() => { void props.onPage(props.page - 1); }}>Anterior</button>
        <button className="k-button" type="button" disabled={props.loading || props.page >= pages} onClick={() => { void props.onPage(props.page + 1); }}>Próxima</button>
      </div>
    </div>
  );
}

function useInventoryPage(initial: InventoryPage) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(page: number, clear = false): Promise<void> {
    setLoading(true); setError("");
    if (clear) setSearch("");
    try {
      setData(await listMerchantInventory({ data: {
        page, pageSize: PAGE_SIZE, search: clear ? undefined : search.trim() || undefined,
      } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o estoque.");
    } finally { setLoading(false); }
  }
  return { data, search, setSearch, loading, error, load };
}

function useHistoryPage(initial: InventoryHistoryPage) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(page: number, clear = false): Promise<void> {
    setLoading(true); setError("");
    if (clear) { setSearch(""); setMovementType(""); }
    try {
      setData(await listMerchantInventoryHistory({ data: {
        page, pageSize: PAGE_SIZE,
        search: clear ? undefined : search.trim() || undefined,
        movementType: clear || !movementType ? undefined : movementType as StockMovementType,
      } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
    } finally { setLoading(false); }
  }
  return { data, search, setSearch, movementType, setMovementType, loading, error, load };
}

type InventoryState = ReturnType<typeof useInventoryPage>;
type HistoryState = ReturnType<typeof useHistoryPage>;

function InventorySection(props: Readonly<{
  state: InventoryState;
  onMovement: () => Promise<void>;
}>): React.JSX.Element {
  const { state } = props;
  function submit(event: SyntheticEvent<HTMLFormElement>): void { event.preventDefault(); void state.load(1); }
  return (
    <section className="k-workspace-section">
      <div className="k-section-head">
        <div><h2>Produtos em estoque</h2><p>{state.data.total} produto(s) ou variante(s) encontrados.</p></div>
      </div>
      <form className="k-toolbar" onSubmit={submit}>
        <label className="k-toolbar__search">
          <span className="k-visually-hidden">Buscar estoque</span>
          <input id="inventory-search" value={state.search} onChange={(event) => { state.setSearch(event.target.value); }} placeholder="Buscar produto, variante ou SKU…" />
        </label>
        <button className="k-button k-button--primary" type="submit" disabled={state.loading}>Buscar</button>
        {state.search ? <button className="k-button k-button--ghost" type="button" disabled={state.loading} onClick={() => { void state.load(1, true); }}>Limpar</button> : null}
        {state.loading ? <span className="k-status">Carregando…</span> : null}
      </form>

      {state.error ? <div className="k-inline-state k-inline-state--error"><strong>Não foi possível carregar</strong><span>{state.error}</span><button className="k-button" type="button" onClick={() => { void state.load(state.data.page); }}>Tentar novamente</button></div> : null}
      {!state.error && !state.loading && state.data.items.length === 0 ? <div className="k-inline-state"><strong>Nenhum produto encontrado</strong><span>Ajuste sua busca ou cadastre estoque.</span></div> : null}

      {!state.error && state.data.items.length > 0 ? (
        <div className="k-table-wrap k-table-wrap--flush">
          <table className="k-table">
            <thead><tr><th>Produto</th><th>Variante</th><th>SKU</th><th>Saldo</th><th className="k-table__action">Ação</th></tr></thead>
            <tbody>{state.data.items.map((item) => (
              <tr key={`${item.productId}:${item.variantId ?? "base"}`}>
                <td><strong>{item.productName}</strong></td>
                <td>{item.variantName ?? <span className="k-muted">Produto simples</span>}</td>
                <td>{item.sku ?? "—"}</td>
                <td><span className={item.currentQuantity <= 5 ? "k-stock k-stock--low" : "k-stock"}>{item.trackInventory ? item.currentQuantity : "Não controlado"}</span></td>
                <td className="k-table__action">{item.trackInventory ? <InventoryAdjustment productId={item.productId} variantId={item.variantId} onCompleted={props.onMovement} /> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {state.data.total > 0 ? <Pager page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} loading={state.loading} onPage={state.load} /> : null}
    </section>
  );
}

function HistorySection({ state }: Readonly<{ state: HistoryState }>): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void { event.preventDefault(); void state.load(1); }
  return (
    <section className="k-workspace-section">
      <div className="k-section-head">
        <div><h2>Histórico de movimentações</h2><p>Entradas, saídas, ajustes e referências operacionais.</p></div>
      </div>
      <form className="k-toolbar" onSubmit={submit}>
        <label className="k-toolbar__search">
          <span className="k-visually-hidden">Buscar histórico</span>
          <input id="history-search" value={state.search} onChange={(event) => { state.setSearch(event.target.value); }} placeholder="Buscar produto, SKU ou motivo…" />
        </label>
        <label className="k-toolbar__select">
          <span className="k-visually-hidden">Tipo de movimentação</span>
          <select id="history-type" value={state.movementType} onChange={(event) => { state.setMovementType(event.target.value); }}>
            <option value="">Todos os tipos</option>
            {MOVEMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button className="k-button k-button--primary" type="submit" disabled={state.loading}>Filtrar</button>
        {(state.search || state.movementType) ? <button className="k-button k-button--ghost" type="button" disabled={state.loading} onClick={() => { void state.load(1, true); }}>Limpar</button> : null}
      </form>

      {state.error ? <div className="k-inline-state k-inline-state--error"><strong>Não foi possível carregar</strong><span>{state.error}</span><button className="k-button" type="button" onClick={() => { void state.load(state.data.page); }}>Tentar novamente</button></div> : null}
      {!state.error && !state.loading && state.data.items.length === 0 ? <div className="k-inline-state"><strong>Nenhuma movimentação encontrada</strong><span>Ajuste a busca ou registre uma movimentação em um item de estoque.</span></div> : null}

      {!state.error && state.data.items.length > 0 ? (
        <div className="k-table-wrap k-table-wrap--flush">
          <table className="k-table">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Motivo</th><th>Ator</th></tr></thead>
            <tbody>{state.data.items.map((movement) => (
              <tr key={movement.id}>
                <td className="k-table__nowrap">{formatDate(movement.createdAt)}</td>
                <td><strong>{movement.productName}</strong><div className="k-row__meta">{movement.variantName ?? "Produto simples"}{movement.sku ? ` · ${movement.sku}` : ""}</div></td>
                <td><span className="k-type-pill">{movementLabel(movement.movementType)}</span></td>
                <td className={movement.delta < 0 ? "k-quantity is-negative" : "k-quantity"}>{movement.delta > 0 ? `+${String(movement.delta)}` : movement.delta}</td>
                <td>{movement.reason}<div className="k-row__meta">{movement.referenceType ? `${movement.referenceType}: ${movement.referenceId ?? "—"}` : "Sem referência externa"}</div></td>
                <td>{movement.createdBy ?? "Sistema"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {state.data.total > 0 ? <Pager page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} loading={state.loading} onPage={state.load} /> : null}
    </section>
  );
}

export function InventoryManager(props: Readonly<{
  initialInventory: InventoryPage;
  initialHistory: InventoryHistoryPage;
}>): React.JSX.Element {
  const inventory = useInventoryPage(props.initialInventory);
  const history = useHistoryPage(props.initialHistory);
  async function refresh(): Promise<void> {
    await Promise.all([inventory.load(inventory.data.page), history.load(1)]);
  }
  return <div className="k-workspace"><InventorySection state={inventory} onMovement={refresh} /><HistorySection state={history} /></div>;
}
