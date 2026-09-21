import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { MerchantTask } from "../../../../../packages/merchant-ops/src/types.ts";
import {
  createMerchantTask,
  listMerchantTasks,
  setMerchantTaskStatus,
  updateMerchantTask,
} from "../../lib/server/operations-merchant.functions.ts";
import type { MerchantTaskAssigneeOption } from "../../lib/server/operations-merchant.functions.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { roleLabel } from "../../lib/ui-labels.ts";
import { formatDate, messageFrom } from "./merchant-operations-utils.ts";

type TaskForm = { title: string; description: string; priority: "low" | "normal" | "high"; dueAt: string; assigneeUserId: string };
const EMPTY: TaskForm = { title: "", description: "", priority: "normal", dueAt: "", assigneeUserId: "" };

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function fromTask(task: MerchantTask): TaskForm {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    dueAt: dateInput(task.dueAt),
    assigneeUserId: task.assigneeUserId ?? "",
  };
}

function assigneeLabel(options: readonly MerchantTaskAssigneeOption[], userId: string | null): string {
  if (!userId) return "Sem responsável";
  const option = options.find((item) => item.userId === userId);
  return option ? `${roleLabel(option.role)} · ${option.userId.slice(0, 8)}…` : "Responsável indisponível";
}

export function MerchantTasksManager(props: Readonly<{ initial: MerchantTask[]; assignees: MerchantTaskAssigneeOption[] }>): React.JSX.Element {
  const [items, setItems] = useState(props.initial); const [form, setForm] = useState<TaskForm>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function reload(): Promise<void> { setItems(await listMerchantTasks()); }
  function reset(): void { setEditingId(null); setForm(EMPTY); }
  function edit(task: MerchantTask): void { setEditingId(task.id); setForm(fromTask(task)); setError(""); setSuccess(""); }
  function taskInput() { return { title: form.title, description: form.description.trim() || null, priority: form.priority, dueAt: form.dueAt ? new Date(`${form.dueAt}T12:00:00`).toISOString() : null, assigneeUserId: form.assigneeUserId || null }; }
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try { if (editingId) await updateMerchantTask({ data: { taskId: editingId, input: taskInput() } }); else await createMerchantTask({ data: taskInput() }); setSuccess(editingId ? "Tarefa atualizada." : "Tarefa criada."); reset(); await reload(); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível salvar a tarefa.")); } finally { setLoading(false); }
  }
  async function changeStatus(task: MerchantTask): Promise<void> {
    const next = task.status === "open" ? "done" : "open";
    if (next === "done" && !confirmDangerousAction("Concluir esta tarefa? Ela poderá ser reaberta depois.")) return;
    setLoading(true); setError(""); setSuccess("");
    try { await setMerchantTaskStatus({ data: { taskId: task.id, status: next } }); setSuccess(next === "done" ? "Tarefa concluída." : "Tarefa reaberta."); if (editingId === task.id) reset(); await reload(); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível alterar a tarefa.")); } finally { setLoading(false); }
  }
  return <div className="k-stack">
    <section className="k-card"><div className="k-row"><div><h2>{editingId ? "Editar tarefa" : "Nova tarefa operacional"}</h2><p className="k-muted">Pendências internas da loja com prioridade, prazo e responsável autorizado.</p></div>{editingId ? <button className="k-button" type="button" disabled={loading} onClick={reset}>Cancelar edição</button> : null}</div>
      <form className="k-form" onSubmit={(event) => { void submit(event); }}><div className="k-form__grid">
        <label className="k-field"><span>Título</span><input required minLength={2} maxLength={180} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); }} /></label><label className="k-field"><span>Prioridade</span><select value={form.priority} onChange={(e) => { setForm({ ...form, priority: e.target.value as TaskForm["priority"] }); }}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
        <label className="k-field"><span>Vencimento opcional</span><input type="date" value={form.dueAt} onChange={(e) => { setForm({ ...form, dueAt: e.target.value }); }} /></label><label className="k-field"><span>Responsável</span><select value={form.assigneeUserId} onChange={(e) => { setForm({ ...form, assigneeUserId: e.target.value }); }}><option value="">Sem responsável</option>{props.assignees.map((item) => <option key={item.userId} value={item.userId}>{roleLabel(item.role)} · {item.userId.slice(0, 8)}…</option>)}</select><small>Somente membros da equipe desta loja podem ser selecionados.</small></label>
        <label className="k-field k-field--full"><span>Descrição</span><textarea maxLength={4000} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); }} /></label>
      </div><div className="k-actions"><button className="k-button k-button--primary" disabled={loading} type="submit">{loading ? "Salvando…" : editingId ? "Salvar alterações" : "Criar tarefa"}</button></div></form>
    </section>
    <section className="k-workspace-section"><div className="k-section-head"><div><h2>Tarefas</h2><p>{items.filter((item) => item.status === "open").length} pendência(s) em aberto.</p></div></div>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}{success ? <div className="k-inline-state"><strong>Concluído</strong><span>{success}</span></div> : null}
      {!items.length ? <div className="k-empty"><strong>Nenhuma tarefa</strong><span>Crie uma pendência operacional quando necessário.</span></div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Tarefa</th><th>Prioridade</th><th>Vencimento</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><div className="k-row__meta">{item.description ?? "Sem descrição"}</div></td><td>{item.priority === "high" ? "Alta" : item.priority === "low" ? "Baixa" : "Normal"}</td><td>{formatDate(item.dueAt)}</td><td>{assigneeLabel(props.assignees, item.assigneeUserId)}</td><td><span className={item.status === "done" ? "k-badge k-badge--on" : "k-badge"}>{item.status === "done" ? "Concluída" : "Aberta"}</span></td><td><div className="k-actions"><button className="k-button" disabled={loading} type="button" onClick={() => { edit(item); }}>Editar</button><button className="k-button" disabled={loading} type="button" onClick={() => { void changeStatus(item); }}>{item.status === "open" ? "Concluir" : "Reabrir"}</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
