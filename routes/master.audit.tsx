import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MasterEmptyState, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { masterDate } from "../components/master/format.ts";
import { listMasterAuditAction } from "../lib/server/master-audit.functions.ts";
import type { MasterAuditFilters, MasterAuditResult } from "../lib/server/master-audit.types.ts";

const defaults: MasterAuditFilters = { action: "", actor: "", tenant: "", store: "", resource: "", from: "", to: "", page: 1, pageSize: 30 };

export const Route = createFileRoute("/master/audit")({
  loader: () => listMasterAuditAction({ data: defaults }),
  component: MasterAudit,
});

function AuditToolbar(props: Readonly<{ filters: MasterAuditFilters; busy: boolean; onChange: (key: keyof MasterAuditFilters, value: string) => void; onSubmit: () => void }>): React.JSX.Element {
  const f = props.filters;
  return <form className="console-toolbar" onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>
    <div className="console-toolbar__field"><label htmlFor="audit-action">Ação</label><input id="audit-action" value={f.action} onChange={(event) => { props.onChange("action", event.target.value); }} /></div>
    <div className="console-toolbar__field"><label htmlFor="audit-actor">Ator</label><input id="audit-actor" value={f.actor} onChange={(event) => { props.onChange("actor", event.target.value); }} placeholder="User ID" /></div>
    <div className="console-toolbar__field"><label htmlFor="audit-tenant">Tenant</label><input id="audit-tenant" value={f.tenant} onChange={(event) => { props.onChange("tenant", event.target.value); }} placeholder="Nome, slug ou ID" /></div>
    <div className="console-toolbar__field"><label htmlFor="audit-store">Loja</label><input id="audit-store" value={f.store} onChange={(event) => { props.onChange("store", event.target.value); }} placeholder="Nome, slug ou ID" /></div>
    <div className="console-toolbar__field"><label htmlFor="audit-resource">Recurso</label><input id="audit-resource" value={f.resource} onChange={(event) => { props.onChange("resource", event.target.value); }} /></div>
    <div className="console-toolbar__field"><label htmlFor="audit-from">De</label><input id="audit-from" type="date" value={f.from} onChange={(event) => { props.onChange("from", event.target.value); }} /></div>
    <div className="console-toolbar__field"><label htmlFor="audit-to">Até</label><input id="audit-to" type="date" value={f.to} onChange={(event) => { props.onChange("to", event.target.value); }} /></div>
    <button className="k-button" disabled={props.busy} type="submit">Aplicar filtros</button>
  </form>;
}

function AuditTable({ data }: Readonly<{ data: MasterAuditResult }>): React.JSX.Element {
  if (!data.items.length) return <MasterEmptyState title="Sem eventos" description="Nenhum audit_log corresponde aos filtros atuais." />;
  return <div className="master-table-wrap"><table className="master-table">
    <thead><tr><th>Ação</th><th>Recurso</th><th>Tenant</th><th>Loja</th><th>Ator</th><th>Data</th></tr></thead>
    <tbody>{data.items.map((item) => <tr key={item.id}>
      <td>{item.action}</td><td><strong>{item.resourceType}</strong><small>{item.resourceId ?? "—"}</small></td>
      <td>{item.tenantName ?? item.tenantId ?? "—"}</td><td>{item.storeName ?? item.storeId ?? "—"}</td>
      <td>{item.actorUserId ?? "Sistema"}</td><td>{masterDate(item.createdAt)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function MasterAudit(): React.JSX.Element {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<MasterAuditResult>(initial);
  const [filters, setFilters] = useState<MasterAuditFilters>(defaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function change(key: keyof MasterAuditFilters, value: string): void { setFilters((current) => ({ ...current, [key]: value })); }
  async function load(page: number): Promise<void> {
    setBusy(true); setMessage("");
    try { setData(await listMasterAuditAction({ data: { ...filters, page } })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao carregar auditoria."); }
    finally { setBusy(false); }
  }
  return <div className="master-stack console-page">
    <MasterPageHeader title="Auditoria" description="Eventos reais de audit_logs com filtros e paginação executados no servidor." action={<span className="console-context-note">{data.total} eventos</span>} />
    <MasterPanel title="Eventos"><AuditToolbar filters={filters} busy={busy} onChange={change} onSubmit={() => { void load(1); }} />{message ? <div className="k-status" role="status">{message}</div> : null}<AuditTable data={data} /><div className="console-pagination"><button className="k-button" type="button" disabled={busy || data.page <= 1} onClick={() => { void load(data.page - 1); }}>Anterior</button><span>Página {data.page} de {data.pageCount}</span><button className="k-button" type="button" disabled={busy || data.page >= data.pageCount} onClick={() => { void load(data.page + 1); }}>Próxima</button></div></MasterPanel>
  </div>;
}
