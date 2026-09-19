import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { MerchantTask } from "../../../../../packages/merchant-ops/src/types.ts";
import {
  completeMerchantTask,
  createMerchantTask,
  listMerchantTasks,
} from "../../lib/server/operations-merchant.functions.ts";
import { formatDate, messageFrom } from "./merchant-operations-utils.ts";

export function MerchantTasksManager({ initial }: Readonly<{ initial: MerchantTask[] }>): React.JSX.Element {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal" as "low" | "normal" | "high", dueAt: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function reload(): Promise<void> { setItems(await listMerchantTasks()); }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      await createMerchantTask({ data: {
        title: form.title,
        description: form.description.trim() || null,
        priority: form.priority,
        dueAt: form.dueAt ? new Date(`${form.dueAt}T12:00:00`).toISOString() : null,
        assigneeUserId: null,
      } });
      setForm({ title: "", description: "", priority: "normal", dueAt: "" });
      setSuccess("Tarefa criada."); await reload();
    } catch (cause) { setError(messageFrom(cause, "Não foi possível criar a tarefa.")); }
    finally { setLoading(false); }
  }

  async function complete(taskId: string): Promise<void> {
    setLoading(true); setError(""); setSuccess("");
    try { await completeMerchantTask({ data: { taskId } }); setSuccess("Tarefa concluída."); await reload(); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível concluir a tarefa.")); }
    finally { setLoading(false); }
  }

  return <div className="k-stack">
    <section className="k-card">
      <h2>Nova tarefa operacional</h2>
      <p className="k-muted">Pendências internas simples da loja, sem criar um sistema paralelo de projetos.</p>
      <form className="k-form" onSubmit={(event) => { void submit(event); }}>
        <div className="k-form__grid">
          <label className="k-field"><span>Título</span><input required minLength={2} maxLength={180} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); }} /></label>
          <label className="k-field"><span>Prioridade</span><select value={form.priority} onChange={(e) => { setForm({ ...form, priority: e.target.value as typeof form.priority }); }}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
          <label className="k-field"><span>Vencimento opcional</span><input type="date" value={form.dueAt} onChange={(e) => { setForm({ ...form, dueAt: e.target.value }); }} /></label>
          <label className="k-field k-field--full"><span>Descrição</span><textarea maxLength={4000} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); }} /></label>
        </div>
        <div className="k-actions"><button className="k-button k-button--primary" disabled={loading} type="submit">Criar tarefa</button></div>
      </form>
    </section>
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Tarefas</h2><p>{items.filter((item) => item.status === "open").length} pendência(s) em aberto.</p></div></div>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
      {success ? <div className="k-inline-state"><strong>Concluído</strong><span>{success}</span></div> : null}
      {!items.length ? <div className="k-empty"><strong>Nenhuma tarefa</strong><span>Crie uma pendência operacional quando necessário.</span></div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Tarefa</th><th>Prioridade</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><div className="k-row__meta">{item.description ?? "Sem descrição"}</div></td><td>{item.priority === "high" ? "Alta" : item.priority === "low" ? "Baixa" : "Normal"}</td><td>{formatDate(item.dueAt)}</td><td><span className={item.status === "done" ? "k-badge k-badge--on" : "k-badge"}>{item.status === "done" ? "Concluída" : "Aberta"}</span></td><td>{item.status === "open" ? <button className="k-button k-button--primary" disabled={loading} type="button" onClick={() => { void complete(item.id); }}>Concluir</button> : "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
