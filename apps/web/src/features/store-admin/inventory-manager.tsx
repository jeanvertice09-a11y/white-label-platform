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
  return <div className="k-actions">
    <button className="k-button" type="button" disabled={props.loading || props.page <= 1} onClick={() => { void props.onPage(props.page - 1); }}>Anterior</button>
    <span className="k-status">Página {props.page} de {pages} · {props.total} registro(s)</span>
    <button className="k-button" type="button" disabled={props.loading || props.page >= pages} onClick={() => { void props.onPage(props.page + 1); }}>Próxima</button>
  </div>;
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
  return <>
    <form className="k-card k-form" onSubmit={submit}>
      <div className="k-form__grid"><div className="k-field"><label htmlFor="inventory-search">Buscar estoque</label>
        <input id="inventory-search" value={state.search} onChange={(event) => { state.setSearch(event.target.value); }} placeholder="Produto, variante ou SKU" />
      </div></div>
      <div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={state.loading}>Buscar</button>
        <button className="k-button" type="button" disabled={state.loading} onClick={() => { void state.load(1, true); }}>Limpar</button>
        {state.loading ? <span className="k-status">Carregando…</span> : null}</div>
    </form>
    {state.error ? <div className="k-empty"><p>{state.error}</p><button className="k-button" type="button" onClick={() => { void state.load(state.data.page); }}>Tentar novamente</button></div> : null}
    {!state.error && !state.loading && state.data.items.length === 0 ? <div className="k-empty">Nenhum item de estoque encontrado.</div> : null}
    {!state.error && state.data.items.length > 0 ? <div className="k-card k-table-wrap"><table className="k-table">
      <thead><tr><th>Produto / variante</th><th>SKU</th><th>Saldo</th><th>Movimentar</th></tr></thead>
      <tbody>{state.data.items.map((item) => <tr key={`${item.productId}:${item.variantId ?? "base"}`}>
        <td><strong>{item.productName}</strong><div className="k-row__meta">{item.variantName ?? "Produto simples"}</div></td>
        <td>{item.sku ?? "—"}</td><td><span className={item.currentQuantity <= 5 ? "k-badge" : "k-badge k-badge--on"}>{item.trackInventory ? item.currentQuantity : "Não controlado"}</span></td>
        <td>{item.trackInventory ? <InventoryAdjustment productId={item.productId} variantId={item.variantId} onCompleted={props.onMovement} /> : "—"}</td>
      </tr>)}</tbody>
    </table></div> : null}
    {state.data.total > 0 ? <Pager page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} loading={state.loading} onPage={state.load} /> : null}
  </>;
}

function HistorySection({ state }: Readonly<{ state: HistoryState }>): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void { event.preventDefault(); void state.load(1); }
  return <>
    <section className="k-card k-form"><h2>Histórico de movimentações</h2><form onSubmit={submit}>
      <div className="k-form__grid"><div className="k-field"><label htmlFor="history-search">Buscar histórico</label>
        <input id="history-search" value={state.search} onChange={(event) => { state.setSearch(event.target.value); }} placeholder="Produto, variante, SKU ou motivo" /></div>
        <div className="k-field"><label htmlFor="history-type">Tipo</label><select id="history-type" value={state.movementType} onChange={(event) => { state.setMovementType(event.target.value); }}><option value="">Todos</option>
          {MOVEMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
      <div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={state.loading}>Filtrar</button>
        <button className="k-button" type="button" disabled={state.loading} onClick={() => { void state.load(1, true); }}>Limpar</button>
        {state.loading ? <span className="k-status">Carregando…</span> : null}</div>
    </form></section>
    {state.error ? <div className="k-empty"><p>{state.error}</p><button className="k-button" type="button" onClick={() => { void state.load(state.data.page); }}>Tentar novamente</button></div> : null}
    {!state.error && !state.loading && state.data.items.length === 0 ? <div className="k-empty">Nenhuma movimentação encontrada.</div> : null}
    {!state.error && state.data.items.length > 0 ? <div className="k-card k-table-wrap"><table className="k-table">
      <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Motivo / referência</th><th>Ator</th></tr></thead>
      <tbody>{state.data.items.map((movement) => <tr key={movement.id}><td>{formatDate(movement.createdAt)}</td>
        <td><strong>{movement.productName}</strong><div className="k-row__meta">{movement.variantName ?? "Produto simples"}{movement.sku ? ` · ${movement.sku}` : ""}</div></td>
        <td>{movementLabel(movement.movementType)}</td><td>{movement.delta > 0 ? `+${String(movement.delta)}` : movement.delta}</td>
        <td>{movement.reason}<div className="k-row__meta">{movement.referenceType ? `${movement.referenceType}: ${movement.referenceId ?? "—"}` : "Sem referência externa"}</div></td><td>{movement.createdBy ?? "Sistema"}</td></tr>)}</tbody>
    </table></div> : null}
    {state.data.total > 0 ? <Pager page={state.data.page} pageSize={state.data.pageSize} total={state.data.total} loading={state.loading} onPage={state.load} /> : null}
  </>;
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
  return <div className="k-page"><InventorySection state={inventory} onMovement={refresh} /><HistorySection state={history} /></div>;
}
