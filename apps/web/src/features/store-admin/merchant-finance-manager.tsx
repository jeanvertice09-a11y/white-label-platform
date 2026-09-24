import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { FinanceSummary, FinancialCategory, FinancialEntry, Page } from "../../../../../packages/merchant-ops/src/types.ts";
import {
  cancelMerchantFinancialEntry,
  createMerchantFinancialCategory,
  createMerchantFinancialEntry,
  listMerchantFinance,
  settleMerchantFinancialEntry,
  summarizeMerchantFinance,
  updateMerchantFinancialCategory,
} from "../../lib/server/operations-merchant.functions.ts";
import { formatCurrency, formatDate, messageFrom, monthRange, parseMoneyToCents, today } from "./merchant-operations-utils.ts";

const PAGE_SIZE = 25;
type EntryDirection = "receivable" | "payable";
type CategoryDirection = "income" | "expense" | "both";
type DirectionFilter = "" | EntryDirection;
type StatusFilter = "" | "open" | "settled" | "cancelled";
type EntryFormState = {
  direction: EntryDirection;
  categoryId: string;
  description: string;
  amount: string;
  dueAt: string;
  competenceDate: string;
  notes: string;
};
type MerchantFinanceManagerProps = Readonly<{
  initial: Page<FinancialEntry>;
  initialSummary: FinanceSummary;
  categories: FinancialCategory[];
}>;

function createInitialEntryForm(): EntryFormState {
  return { direction: "receivable", categoryId: "", description: "", amount: "0,00", dueAt: today(), competenceDate: today(), notes: "" };
}

function useMerchantFinanceState(props: MerchantFinanceManagerProps) {
  const range = monthRange();
  const [data, setData] = useState(props.initial);
  const [summary, setSummary] = useState(props.initialSummary);
  const [categories, setCategories] = useState(props.categories);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [form, setForm] = useState<EntryFormState>(createInitialEntryForm);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDirection, setCategoryDirection] = useState<CategoryDirection>("both");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return {
    data, setData, summary, setSummary, categories, setCategories, from, setFrom, to, setTo,
    directionFilter, setDirectionFilter, statusFilter, setStatusFilter, form, setForm,
    categoryName, setCategoryName, categoryDirection, setCategoryDirection,
    editingCategoryId, setEditingCategoryId,
    loading, setLoading, error, setError, success, setSuccess,
  };
}

type MerchantFinanceState = ReturnType<typeof useMerchantFinanceState>;

async function reloadFinance(state: MerchantFinanceState, page = 1): Promise<void> {
  const [entries, nextSummary] = await Promise.all([
    listMerchantFinance({ data: {
      page, pageSize: PAGE_SIZE,
      direction: state.directionFilter || undefined,
      status: state.statusFilter || undefined,
      from: state.from || undefined,
      to: state.to || undefined,
    } }),
    summarizeMerchantFinance({ data: { from: state.from, to: state.to } }),
  ]);
  state.setData(entries);
  state.setSummary(nextSummary);
}

async function filterFinance(event: SyntheticEvent<HTMLFormElement>, state: MerchantFinanceState): Promise<void> {
  event.preventDefault(); state.setLoading(true); state.setError("");
  try {
    await reloadFinance(state, 1);
  } catch (cause) {
    state.setError(messageFrom(cause, "Não foi possível carregar o financeiro."));
  } finally {
    state.setLoading(false);
  }
}

async function createEntry(event: SyntheticEvent<HTMLFormElement>, state: MerchantFinanceState): Promise<void> {
  event.preventDefault(); state.setLoading(true); state.setError(""); state.setSuccess("");
  try {
    await createMerchantFinancialEntry({ data: {
      direction: state.form.direction,
      categoryId: state.form.categoryId || null,
      description: state.form.description,
      amountCents: parseMoneyToCents(state.form.amount),
      dueAt: state.form.dueAt,
      competenceDate: state.form.competenceDate,
      notes: state.form.notes.trim() || null,
    } });
    state.setForm(createInitialEntryForm());
    state.setSuccess("Lançamento financeiro criado.");
    await reloadFinance(state, 1);
  } catch (cause) {
    state.setError(messageFrom(cause, "Não foi possível criar o lançamento."));
  } finally {
    state.setLoading(false);
  }
}

async function createCategory(event: SyntheticEvent<HTMLFormElement>, state: MerchantFinanceState): Promise<void> {
  event.preventDefault(); state.setLoading(true); state.setError(""); state.setSuccess("");
  try {
    const saved = state.editingCategoryId
      ? await updateMerchantFinancialCategory({ data: { categoryId: state.editingCategoryId, name: state.categoryName, direction: state.categoryDirection, active: state.categories.find((item) => item.id === state.editingCategoryId)?.active ?? true } })
      : await createMerchantFinancialCategory({ data: { name: state.categoryName, direction: state.categoryDirection } });
    state.setCategories((state.editingCategoryId
      ? state.categories.map((item) => item.id === saved.id ? saved : item)
      : [...state.categories, saved]).sort((a, b) => a.name.localeCompare(b.name)));
    state.setCategoryName("");
    state.setCategoryDirection("both");
    state.setEditingCategoryId(null);
    state.setSuccess(state.editingCategoryId ? "Categoria financeira atualizada." : "Categoria financeira criada.");
  } catch (cause) {
    state.setError(messageFrom(cause, "Não foi possível criar a categoria."));
  } finally {
    state.setLoading(false);
  }
}

async function toggleCategory(category: FinancialCategory, state: MerchantFinanceState): Promise<void> {
  state.setLoading(true); state.setError(""); state.setSuccess("");
  try {
    const saved = await updateMerchantFinancialCategory({ data: {
      categoryId: category.id,
      name: category.name,
      direction: category.direction,
      active: !category.active,
    } });
    state.setCategories(state.categories.map((item) => item.id === saved.id ? saved : item));
    state.setSuccess(saved.active ? "Categoria reativada." : "Categoria arquivada. Lançamentos existentes foram preservados.");
  } catch (cause) {
    state.setError(messageFrom(cause, "Não foi possível alterar a categoria."));
  } finally {
    state.setLoading(false);
  }
}

async function updateEntry(entry: FinancialEntry, next: "settle" | "cancel", state: MerchantFinanceState): Promise<void> {
  state.setLoading(true); state.setError(""); state.setSuccess("");
  try {
    if (next === "settle") {
      await settleMerchantFinancialEntry({ data: { entryId: entry.id } });
      state.setSuccess(entry.direction === "receivable" ? "Recebimento registrado." : "Pagamento registrado.");
    } else {
      await cancelMerchantFinancialEntry({ data: { entryId: entry.id } });
      state.setSuccess("Lançamento cancelado.");
    }
    await reloadFinance(state, state.data.page);
  } catch (cause) {
    state.setError(messageFrom(cause, "Não foi possível atualizar o lançamento."));
  } finally {
    state.setLoading(false);
  }
}

function FinanceSummarySection({ summary }: Readonly<{ summary: FinanceSummary }>): React.JSX.Element {
  return <>
    <section className="k-grid">
      <article className="k-card k-stat"><div className="k-stat__label">A receber em aberto</div><div className="k-stat__value">{formatCurrency(summary.openReceivableCents)}</div><div className="k-row__meta">Vencido: {formatCurrency(summary.overdueReceivableCents)}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">A pagar em aberto</div><div className="k-stat__value">{formatCurrency(summary.openPayableCents)}</div><div className="k-row__meta">Vencido: {formatCurrency(summary.overduePayableCents)}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">Fluxo realizado no período</div><div className="k-stat__value">{formatCurrency(summary.cashFlowCents)}</div><div className="k-row__meta">Entradas {formatCurrency(summary.receivedCents)} · saídas {formatCurrency(summary.paidCents)}</div></article>
    </section>
    <section className="k-card"><div className="k-row"><div><h2>Resultado gerencial</h2><p className="k-muted">Receitas menos despesas por competência. Não é contabilidade oficial nem saldo bancário.</p></div><strong>{formatCurrency(summary.managerialResultCents)}</strong></div></section>
  </>;
}

function FinancialEntryForm({ state }: Readonly<{ state: MerchantFinanceState }>): React.JSX.Element {
  const form = state.form;
  const availableCategories = state.categories.filter((item) => item.active && (item.direction === "both" || item.direction === (form.direction === "receivable" ? "income" : "expense")));
  return <section className="k-card">
    <h2>Novo lançamento</h2>
    <form className="k-form" onSubmit={(event) => { void createEntry(event, state); }}>
      <div className="k-form__grid">
        <label className="k-field"><span>Tipo</span><select value={form.direction} onChange={(e) => { state.setForm({ ...form, direction: e.target.value as EntryDirection, categoryId: "" }); }}><option value="receivable">Conta a receber</option><option value="payable">Conta a pagar</option></select></label>
        <label className="k-field"><span>Categoria</span><select value={form.categoryId} onChange={(e) => { state.setForm({ ...form, categoryId: e.target.value }); }}><option value="">Sem categoria</option>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="k-field"><span>Descrição</span><input required maxLength={240} value={form.description} onChange={(e) => { state.setForm({ ...form, description: e.target.value }); }} /></label>
        <label className="k-field"><span>Valor</span><input required inputMode="decimal" value={form.amount} onChange={(e) => { state.setForm({ ...form, amount: e.target.value }); }} /></label>
        <label className="k-field"><span>Vencimento</span><input type="date" required value={form.dueAt} onChange={(e) => { state.setForm({ ...form, dueAt: e.target.value }); }} /></label>
        <label className="k-field"><span>Competência</span><input type="date" required value={form.competenceDate} onChange={(e) => { state.setForm({ ...form, competenceDate: e.target.value }); }} /></label>
        <label className="k-field k-field--full"><span>Observação</span><textarea maxLength={4000} value={form.notes} onChange={(e) => { state.setForm({ ...form, notes: e.target.value }); }} /></label>
      </div>
      <div className="k-actions"><button className="k-button k-button--primary" disabled={state.loading} type="submit">Criar lançamento</button></div>
    </form>
  </section>;
}

function FinancialCategoryForm({ state }: Readonly<{ state: MerchantFinanceState }>): React.JSX.Element {
  return <section className="k-card">
    <h2>Categorias financeiras</h2>
    <form className="k-form__grid" onSubmit={(event) => { void createCategory(event, state); }}>
      <label className="k-field"><span>Nome</span><input required minLength={2} maxLength={100} value={state.categoryName} onChange={(e) => { state.setCategoryName(e.target.value); }} /></label>
      <label className="k-field"><span>Uso</span><select value={state.categoryDirection} onChange={(e) => { state.setCategoryDirection(e.target.value as CategoryDirection); }}><option value="both">Receitas e despesas</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></label>
      <div className="k-actions k-field--full"><button className="k-button" disabled={state.loading} type="submit">{state.editingCategoryId ? "Salvar categoria" : "Adicionar categoria"}</button>{state.editingCategoryId ? <button className="k-button" type="button" disabled={state.loading} onClick={() => { state.setEditingCategoryId(null); state.setCategoryName(""); state.setCategoryDirection("both"); }}>Cancelar edição</button> : null}</div>
    </form>
    {state.categories.length ? <div className="k-config-list">{state.categories.map((category) => <div className="k-config-row" key={category.id}><span><strong>{category.name}</strong><small>{category.direction === "both" ? "Receitas e despesas" : category.direction === "income" ? "Receitas" : "Despesas"} · {category.active ? "ativa" : "arquivada"}</small></span><div className="k-actions"><button className="k-text-action" type="button" disabled={state.loading} onClick={() => { state.setEditingCategoryId(category.id); state.setCategoryName(category.name); state.setCategoryDirection(category.direction); }}>Editar</button><button className="k-text-action" type="button" disabled={state.loading} onClick={() => { void toggleCategory(category, state); }}>{category.active ? "Arquivar" : "Reativar"}</button></div></div>)}</div> : <p className="k-muted">Nenhuma categoria financeira cadastrada.</p>}
  </section>;
}

function FinancialEntriesSection({ state }: Readonly<{ state: MerchantFinanceState }>): React.JSX.Element {
  return <section className="k-workspace-section">
    <div className="k-section-head"><div><h2>Contas e movimentações</h2><p>Fluxo da aplicação baseado somente nos lançamentos registrados.</p></div></div>
    <form className="k-toolbar" onSubmit={(event) => { void filterFinance(event, state); }}>
      <label className="k-toolbar__select"><span className="k-visually-hidden">Tipo</span><select value={state.directionFilter} onChange={(e) => { state.setDirectionFilter(e.target.value as DirectionFilter); }}><option value="">Receber e pagar</option><option value="receivable">A receber</option><option value="payable">A pagar</option></select></label>
      <label className="k-toolbar__select"><span className="k-visually-hidden">Status</span><select value={state.statusFilter} onChange={(e) => { state.setStatusFilter(e.target.value as StatusFilter); }}><option value="">Todos os status</option><option value="open">Em aberto</option><option value="settled">Liquidado</option><option value="cancelled">Cancelado</option></select></label>
      <label className="k-field"><span>De</span><input type="date" value={state.from} onChange={(e) => { state.setFrom(e.target.value); }} /></label>
      <label className="k-field"><span>Até</span><input type="date" value={state.to} onChange={(e) => { state.setTo(e.target.value); }} /></label>
      <button className="k-button k-button--primary" disabled={state.loading} type="submit">Filtrar</button>
    </form>
    {state.error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{state.error}</span></div> : null}
    {state.success ? <div className="k-inline-state"><strong>Concluído</strong><span>{state.success}</span></div> : null}
    {!state.data.items.length ? <div className="k-empty"><strong>Nenhum lançamento</strong><span>Cadastre uma conta ou ajuste os filtros.</span></div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{state.data.items.map((entry) => <tr key={entry.id}><td><strong>{entry.description}</strong><div className="k-row__meta">{entry.categoryName ?? "Sem categoria"} · competência {formatDate(entry.competenceDate)}</div></td><td>{entry.direction === "receivable" ? "Receber" : "Pagar"}</td><td>{formatDate(entry.dueAt)}</td><td>{formatCurrency(entry.amountCents)}</td><td><span className={entry.status === "settled" ? "k-badge k-badge--on" : "k-badge"}>{entry.status === "open" ? "Em aberto" : entry.status === "settled" ? "Liquidado" : "Cancelado"}</span></td><td>{entry.status === "open" ? <div className="k-row"><button className="k-button k-button--primary" disabled={state.loading} type="button" onClick={() => { void updateEntry(entry, "settle", state); }}>{entry.direction === "receivable" ? "Receber" : "Pagar"}</button><button className="k-button" disabled={state.loading} type="button" onClick={() => { void updateEntry(entry, "cancel", state); }}>Cancelar</button></div> : "—"}</td></tr>)}</tbody></table></div>}
    {state.data.total>0?<div className="k-pagination"><span>{state.data.total} lançamento(s) · página {state.data.page} de {Math.max(1,Math.ceil(state.data.total/state.data.pageSize))}</span><div><button className="k-button" type="button" disabled={state.loading||state.data.page<=1} onClick={()=>{void reloadFinance(state,state.data.page-1).catch(cause=>{state.setError(messageFrom(cause,"Não foi possível carregar o financeiro."));});}}>Anterior</button><button className="k-button" type="button" disabled={state.loading||state.data.page*state.data.pageSize>=state.data.total} onClick={()=>{void reloadFinance(state,state.data.page+1).catch(cause=>{state.setError(messageFrom(cause,"Não foi possível carregar o financeiro."));});}}>Próxima</button></div></div>:null}
  </section>;
}

export function MerchantFinanceManager(props: MerchantFinanceManagerProps): React.JSX.Element {
  const state = useMerchantFinanceState(props);
  return <div className="k-stack">
    <FinanceSummarySection summary={state.summary} />
    <FinancialEntryForm state={state} />
    <FinancialCategoryForm state={state} />
    <FinancialEntriesSection state={state} />
  </div>;
}
