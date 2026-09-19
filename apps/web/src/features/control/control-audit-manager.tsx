import { useState } from "react";
import { getControlAuditWorkspace } from "../../lib/server/control-audit.functions.ts";
import type { ControlAuditFilters, ControlAuditResult } from "../../lib/server/control-audit.types.ts";

const defaults: ControlAuditFilters = { action: "", actor: "", store: "", resource: "", from: "", to: "", page: 1, pageSize: 30 };

function AuditToolbar(props: Readonly<{ filters: ControlAuditFilters; busy: boolean; onChange: (key: keyof ControlAuditFilters, value: string) => void; onSubmit: () => void }>): React.JSX.Element {
  const f = props.filters;
  return <form className="console-toolbar" onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>
    <div className="console-toolbar__field"><label htmlFor="control-audit-action">Ação</label><input id="control-audit-action" value={f.action} onChange={(event) => { props.onChange("action", event.target.value); }} /></div>
    <div className="console-toolbar__field"><label htmlFor="control-audit-actor">Ator</label><input id="control-audit-actor" value={f.actor} onChange={(event) => { props.onChange("actor", event.target.value); }} placeholder="User ID" /></div>
    <div className="console-toolbar__field"><label htmlFor="control-audit-store">Loja</label><input id="control-audit-store" value={f.store} onChange={(event) => { props.onChange("store", event.target.value); }} placeholder="Nome, slug ou ID" /></div>
    <div className="console-toolbar__field"><label htmlFor="control-audit-resource">Recurso</label><input id="control-audit-resource" value={f.resource} onChange={(event) => { props.onChange("resource", event.target.value); }} /></div>
    <div className="console-toolbar__field"><label htmlFor="control-audit-from">De</label><input id="control-audit-from" type="date" value={f.from} onChange={(event) => { props.onChange("from", event.target.value); }} /></div>
    <div className="console-toolbar__field"><label htmlFor="control-audit-to">Até</label><input id="control-audit-to" type="date" value={f.to} onChange={(event) => { props.onChange("to", event.target.value); }} /></div>
    <button className="k-button" disabled={props.busy} type="submit">Aplicar filtros</button>
  </form>;
}

function AuditRows({ data }: Readonly<{ data: ControlAuditResult }>): React.JSX.Element {
  if (!data.items.length) return <div className="control-empty"><strong>Sem eventos</strong><p>Nenhum audit_log corresponde aos filtros atuais.</p></div>;
  return <div className="control-table-wrap"><table className="control-table">
    <thead><tr><th>Data</th><th>Ação</th><th>Recurso</th><th>Loja</th><th>Ator</th></tr></thead>
    <tbody>{data.items.map((item) => <tr key={item.id}>
      <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td>{item.action}</td>
      <td><strong>{item.resourceType}</strong><small>{item.resourceId ?? "—"}</small></td>
      <td>{item.storeName ?? item.storeId ?? "—"}</td><td>{item.actorUserId ?? "Sistema"}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function ControlAuditManager({ initial }: Readonly<{ initial: ControlAuditResult }>): React.JSX.Element {
  const [data, setData] = useState(initial); const [filters, setFilters] = useState(defaults);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  function change(key: keyof ControlAuditFilters, value: string): void { setFilters((current) => ({ ...current, [key]: value })); }
  async function load(page: number): Promise<void> {
    setBusy(true); setMessage("");
    try { setData(await getControlAuditWorkspace({ data: { ...filters, page } })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao carregar auditoria."); }
    finally { setBusy(false); }
  }
  return <section className="control-section" id="audit-management">
    <div className="control-section__head"><div><span className="control-kicker">Governança</span><h2>Auditoria</h2><p>Eventos somente leitura, filtrados no servidor e limitados à White Label atual.</p></div><span className="console-context-note">{data.total} eventos</span></div>
    <div className="control-editorial-section"><AuditToolbar filters={filters} busy={busy} onChange={change} onSubmit={() => { void load(1); }} />{message ? <div className="k-status" role="status">{message}</div> : null}<AuditRows data={data} /><div className="console-pagination"><button className="k-button" type="button" disabled={busy || data.page <= 1} onClick={() => { void load(data.page - 1); }}>Anterior</button><span>Página {data.page} de {data.pageCount}</span><button className="k-button" type="button" disabled={busy || data.page >= data.pageCount} onClick={() => { void load(data.page + 1); }}>Próxima</button></div></div>
  </section>;
}
