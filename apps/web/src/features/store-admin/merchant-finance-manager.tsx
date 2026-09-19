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
} from "../../lib/server/operations-merchant.functions.ts";
import { formatCurrency, formatDate, messageFrom, monthRange, parseMoneyToCents, today } from "./merchant-operations-utils.ts";

const PAGE_SIZE = 25;

export function MerchantFinanceManager(props: Readonly<{
  initial: Page<FinancialEntry>;
  initialSummary: FinanceSummary;
  categories: FinancialCategory[];
}>): React.JSX.Element {
  const range = monthRange();
  const [data, setData] = useState(props.initial);
  const [summary, setSummary] = useState(props.initialSummary);
  const [categories, setCategories] = useState(props.categories);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [directionFilter, setDirectionFilter] = useState<"" | "receivable" | "payable">("");
  const [statusFilter, setStatusFilter] = useState<"" | "open" | "settled" | "cancelled">("");
  const [form, setForm] = useState({ direction: "receivable" as "receivable" | "payable", categoryId: "", description: "", amount: "0,00", dueAt: today(), competenceDate: today(), notes: "" });
  const [categoryName, setCategoryName] = useState("");
  const [categoryDirection, setCategoryDirection] = useState<"income" | "expense" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function reload(page = 1): Promise<void> {
    const [entries, nextSummary] = await Promise.all([
      listMerchantFinance({ data: {
        page, pageSize: PAGE_SIZE,
        direction: directionFilter || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      } }),
      summarizeMerchantFinance({ data: { from, to } }),
    ]);
    setData(entries); setSummary(nextSummary);
  }

  async function filter(event?: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault(); setLoading(true); setError("");
    try { await reload(1); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível carregar o financeiro.")); }
    finally { setLoading(false); }
  }

  async function createEntry(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      await createMerchantFinancialEntry({ data: {
        direction: form.direction,
        categoryId: form.categoryId || null,
        description: form.description,
        amountCents: parseMoneyToCents(form.amount),
        dueAt: form.dueAt,
        competenceDate: form.competenceDate,
        notes: form.notes.trim() || null,
      } });
      setForm({ direction: "receivable", categoryId: "", description: "", amount: "0,00", dueAt: today(), competenceDate: today(), notes: "" });
      setSuccess("Lançamento financeiro criado.");
      await reload(1);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível criar o lançamento.")); }
    finally { setLoading(false); }
  }

  async function createCategory(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      const created = await createMerchantFinancialCategory({ data: { name: categoryName, direction: categoryDirection } });
      setCategories([...categories, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryName(""); setCategoryDirection("both"); setSuccess("Categoria financeira criada.");
    } catch (cause) { setError(messageFrom(cause, "Não foi possível criar a categoria.")); }
    finally { setLoading(false); }
  }

  async function action(entry: FinancialEntry, next: "settle" | "cancel"): Promise<void> {
    setLoading(true); setError(""); setSuccess("");
    try {
      if (next === "settle") {
        await settleMerchantFinancialEntry({ data: { entryId: entry.id } });
        setSuccess(entry.direction === "receivable" ? "Recebimento registrado." : "Pagamento registrado.");
      } else {
        await cancelMerchantFinancialEntry({ data: { entryId: entry.id } });
        setSuccess("Lançamento cancelado.");
      }
      await reload(data.page);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível atualizar o lançamento.")); }
    finally { setLoading(false); }
  }

  return <div className="k-stack">
    <section className="k-grid">
      <article className="k-card k-stat"><div className="k-stat__label">A receber em aberto</div><div className="k-stat__value">{formatCurrency(summary.openReceivableCents)}</div><div className="k-row__meta">Vencido: {formatCurrency(summary.overdueReceivableCents)}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">A pagar em aberto</div><div className="k-stat__value">{formatCurrency(summary.openPayableCents)}</div><div className="k-row__meta">Vencido: {formatCurrency(summary.overduePayableCents)}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">Fluxo realizado no período</div><div className="k-stat__value">{formatCurrency(summary.cashFlowCents)}</div><div className="k-row__meta">Entradas {formatCurrency(summary.receivedCents)} · saídas {formatCurrency(summary.paidCents)}</div></article>
    </section>
    <section className="k-card"><div className="k-row"><div><h2>Resultado gerencial</h2><p className="k-muted">Receitas menos despesas por competência. Não é contabilidade oficial nem saldo bancário.</p></div><strong>{formatCurrency(summary.managerialResultCents)}</strong></div></section>

    <section className="k-card">
      <h2>Novo lançamento</h2>
      <form className="k-form" onSubmit={(event) => { void createEntry(event); }}>
        <div className="k-form__grid">
          <label className="k-field"><span>Tipo</span><select value={form.direction} onChange={(e) => { setForm({ ...form, direction: e.target.value as "receivable" | "payable", categoryId: "" }); }}><option value="receivable">Conta a receber</option><option value="payable">Conta a pagar</option></select></label>
          <label className="k-field"><span>Categoria</span><select value={form.categoryId} onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); }}><option value="">Sem categoria</option>{categories.filter((item) => item.active && (item.direction === "both" || item.direction === (form.direction === "receivable" ? "income" : "expense"))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="k-field"><span>Descrição</span><input required maxLength={240} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); }} /></label>
          <label className="k-field"><span>Valor</span><input required inputMode="decimal" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); }} /></label>
          <label className="k-field"><span>Vencimento</span><input type="date" required value={form.dueAt} onChange={(e) => { setForm({ ...form, dueAt: e.target.value }); }} /></label>
          <label className="k-field"><span>Competência</span><input type="date" required value={form.competenceDate} onChange={(e) => { setForm({ ...form, competenceDate: e.target.value }); }} /></label>
          <label className="k-field k-field--full"><span>Observação</span><textarea maxLength={4000} value={form.notes} onChange={(e) => { setForm({ ...form, notes: e.target.value }); }} /></label>
        </div>
        <div className="k-actions"><button className="k-button k-button--primary" disabled={loading} type="submit">Criar lançamento</button></div>
      </form>
    </section>

    <section className="k-card">
      <h2>Categorias financeiras</h2>
      <form className="k-form__grid" onSubmit={(event) => { void createCategory(event); }}>
        <label className="k-field"><span>Nome</span><input required minLength={2} maxLength={100} value={categoryName} onChange={(e) => { setCategoryName(e.target.value); }} /></label>
        <label className="k-field"><span>Uso</span><select value={categoryDirection} onChange={(e) => { setCategoryDirection(e.target.value as "income" | "expense" | "both"); }}><option value="both">Receitas e despesas</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></label>
        <div className="k-actions k-field--full"><button className="k-button" disabled={loading} type="submit">Adicionar categoria</button></div>
      </form>
    </section>

    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Contas e movimentações</h2><p>Fluxo da aplicação baseado somente nos lançamentos registrados.</p></div></div>
      <form className="k-toolbar" onSubmit={(event) => { void filter(event); }}>
        <label className="k-toolbar__select"><span className="k-visually-hidden">Tipo</span><select value={directionFilter} onChange={(e) => { setDirectionFilter(e.target.value as typeof directionFilter); }}><option value="">Receber e pagar</option><option value="receivable">A receber</option><option value="payable">A pagar</option></select></label>
        <label className="k-toolbar__select"><span className="k-visually-hidden">Status</span><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); }}><option value="">Todos os status</option><option value="open">Em aberto</option><option value="settled">Liquidado</option><option value="cancelled">Cancelado</option></select></label>
        <label className="k-field"><span>De</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); }} /></label>
        <label className="k-field"><span>Até</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); }} /></label>
        <button className="k-button k-button--primary" disabled={loading} type="submit">Filtrar</button>
      </form>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
      {success ? <div className="k-inline-state"><strong>Concluído</strong><span>{success}</span></div> : null}
      {!data.items.length ? <div className="k-empty"><strong>Nenhum lançamento</strong><span>Cadastre uma conta ou ajuste os filtros.</span></div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.items.map((entry) => <tr key={entry.id}><td><strong>{entry.description}</strong><div className="k-row__meta">{entry.categoryName ?? "Sem categoria"} · competência {formatDate(entry.competenceDate)}</div></td><td>{entry.direction === "receivable" ? "Receber" : "Pagar"}</td><td>{formatDate(entry.dueAt)}</td><td>{formatCurrency(entry.amountCents)}</td><td><span className={entry.status === "settled" ? "k-badge k-badge--on" : "k-badge"}>{entry.status === "open" ? "Em aberto" : entry.status === "settled" ? "Liquidado" : "Cancelado"}</span></td><td>{entry.status === "open" ? <div className="k-row"><button className="k-button k-button--primary" disabled={loading} type="button" onClick={() => { void action(entry, "settle"); }}>{entry.direction === "receivable" ? "Receber" : "Pagar"}</button><button className="k-button" disabled={loading} type="button" onClick={() => { void action(entry, "cancel"); }}>Cancelar</button></div> : "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
