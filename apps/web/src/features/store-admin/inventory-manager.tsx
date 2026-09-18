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
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => Promise<void>;
}>): React.JSX.Element {
  const pages = totalPages(props.total, props.pageSize);
  return (
    <div className="k-actions">
      <button className="k-button" type="button" disabled={props.loading || props.page <= 1} onClick={() => { void props.onPage(props.page - 1); }}>Anterior</button>
      <span className="k-status">Página {props.page} de {pages} · {props.total} registro(s)</span>
      <button className="k-button" type="button" disabled={props.loading || props.page >= pages} onClick={() => { void props.onPage(props.page + 1); }}>Próxima</button>
    </div>
  );
}

export function InventoryManager(props: Readonly<{
  initialInventory: InventoryPage;
  initialHistory: InventoryHistoryPage;
}>): React.JSX.Element {
  const [inventory, setInventory] = useState(props.initialInventory);
  const [history, setHistory] = useState(props.initialHistory);
  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [historyError, setHistoryError] = useState("");

  async function loadInventory(page: number, clear = false): Promise<void> {
    setLoadingInventory(true);
    setInventoryError("");
    if (clear) setSearch("");
    try {
      setInventory(await listMerchantInventory({ data: {
        page,
        pageSize: PAGE_SIZE,
        search: clear ? undefined : search.trim() || undefined,
      } }));
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Não foi possível carregar o estoque.");
    } finally {
      setLoadingInventory(false);
    }
  }

  async function loadHistory(page: number, clear = false): Promise<void> {
    setLoadingHistory(true);
    setHistoryError("");
    if (clear) {
      setHistorySearch("");
      setMovementType("");
    }
    try {
      setHistory(await listMerchantInventoryHistory({ data: {
        page,
        pageSize: PAGE_SIZE,
        search: clear ? undefined : historySearch.trim() || undefined,
        movementType: clear || !movementType ? undefined : movementType as StockMovementType,
      } }));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Não foi possível carregar o histórico.");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function refreshAfterMovement(): Promise<void> {
    await Promise.all([loadInventory(inventory.page), loadHistory(1)]);
  }

  function inventorySubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadInventory(1);
  }

  function historySubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadHistory(1);
  }

  return (
    <div className="k-page">
      <form className="k-card k-form" onSubmit={inventorySubmit}>
        <div className="k-form__grid">
          <div className="k-field"><label htmlFor="inventory-search">Buscar estoque</label>
            <input id="inventory-search" value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Produto, variante ou SKU" />
          </div>
        </div>
        <div className="k-actions">
          <button className="k-button k-button--primary" type="submit" disabled={loadingInventory}>Buscar</button>
          <button className="k-button" type="button" disabled={loadingInventory} onClick={() => { void loadInventory(1, true); }}>Limpar</button>
          {loadingInventory ? <span className="k-status">Carregando…</span> : null}
        </div>
      </form>

      {inventoryError ? <div className="k-empty"><p>{inventoryError}</p><button className="k-button" type="button" onClick={() => { void loadInventory(inventory.page); }}>Tentar novamente</button></div> : null}
      {!inventoryError && !loadingInventory && inventory.items.length === 0 ? <div className="k-empty">Nenhum item de estoque encontrado.</div> : null}
      {!inventoryError && inventory.items.length > 0 ? (
        <div className="k-card k-table-wrap">
          <table className="k-table">
            <thead><tr><th>Produto / variante</th><th>SKU</th><th>Saldo</th><th>Movimentar</th></tr></thead>
            <tbody>{inventory.items.map((item) => (
              <tr key={`${item.productId}:${item.variantId ?? "base"}`}>
                <td><strong>{item.productName}</strong><div className="k-row__meta">{item.variantName ?? "Produto simples"}</div></td>
                <td>{item.sku ?? "—"}</td>
                <td><span className={item.currentQuantity <= 5 ? "k-badge" : "k-badge k-badge--on"}>{item.trackInventory ? item.currentQuantity : "Não controlado"}</span></td>
                <td>{item.trackInventory ? <InventoryAdjustment productId={item.productId} variantId={item.variantId} onCompleted={refreshAfterMovement} /> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {inventory.total > 0 ? <Pager page={inventory.page} pageSize={inventory.pageSize} total={inventory.total} loading={loadingInventory} onPage={loadInventory} /> : null}

      <section className="k-card k-form">
        <h2>Histórico de movimentações</h2>
        <form onSubmit={historySubmit}>
          <div className="k-form__grid">
            <div className="k-field"><label htmlFor="history-search">Buscar histórico</label>
              <input id="history-search" value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); }} placeholder="Produto, variante, SKU ou motivo" />
            </div>
            <div className="k-field"><label htmlFor="history-type">Tipo</label>
              <select id="history-type" value={movementType} onChange={(event) => { setMovementType(event.target.value); }}>
                <option value="">Todos</option>
                {MOVEMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <div className="k-actions">
            <button className="k-button k-button--primary" type="submit" disabled={loadingHistory}>Filtrar</button>
            <button className="k-button" type="button" disabled={loadingHistory} onClick={() => { void loadHistory(1, true); }}>Limpar</button>
            {loadingHistory ? <span className="k-status">Carregando…</span> : null}
          </div>
        </form>
      </section>

      {historyError ? <div className="k-empty"><p>{historyError}</p><button className="k-button" type="button" onClick={() => { void loadHistory(history.page); }}>Tentar novamente</button></div> : null}
      {!historyError && !loadingHistory && history.items.length === 0 ? <div className="k-empty">Nenhuma movimentação encontrada.</div> : null}
      {!historyError && history.items.length > 0 ? (
        <div className="k-card k-table-wrap">
          <table className="k-table">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Motivo / referência</th><th>Ator</th></tr></thead>
            <tbody>{history.items.map((movement) => (
              <tr key={movement.id}>
                <td>{formatDate(movement.createdAt)}</td>
                <td><strong>{movement.productName}</strong><div className="k-row__meta">{movement.variantName ?? "Produto simples"}{movement.sku ? ` · ${movement.sku}` : ""}</div></td>
                <td>{movementLabel(movement.movementType)}</td>
                <td>{movement.delta > 0 ? `+${movement.delta}` : movement.delta}</td>
                <td>{movement.reason}<div className="k-row__meta">{movement.referenceType ? `${movement.referenceType}: ${movement.referenceId ?? "—"}` : "Sem referência externa"}</div></td>
                <td>{movement.createdBy ?? "Sistema"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {history.total > 0 ? <Pager page={history.page} pageSize={history.pageSize} total={history.total} loading={loadingHistory} onPage={loadHistory} /> : null}
    </div>
  );
}
