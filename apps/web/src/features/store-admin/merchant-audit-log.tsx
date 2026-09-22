import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { MerchantAuditPage } from "../../lib/server/merchant-audit.functions.ts";
import { listMerchantAudit } from "../../lib/server/merchant-audit.functions.ts";

const PAGE_SIZE = 25;

function actionLabel(value: string): string {
  return value.replaceAll(".", " › ").replaceAll("_", " ");
}

export function MerchantAuditLog({ initial }: Readonly<{ initial: MerchantAuditPage }>): React.JSX.Element {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(page: number, clear = false): Promise<void> {
    setLoading(true); setError("");
    if (clear) { setSearch(""); setFrom(""); setTo(""); }
    try {
      setData(await listMerchantAudit({ data: {
        page, pageSize: PAGE_SIZE,
        search: clear ? undefined : search.trim() || undefined,
        from: clear ? undefined : from || undefined,
        to: clear ? undefined : to || undefined,
      } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
    } finally { setLoading(false); }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>): void { event.preventDefault(); void load(1); }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <section className="k-workspace-section">
    <div className="k-section-head"><div><h2>Histórico de operações</h2><p>Eventos auditáveis registrados pelo servidor para esta loja.</p></div><span className="k-section-count">{data.total} evento(s)</span></div>
    <form className="k-toolbar" onSubmit={submit}>
      <label className="k-toolbar__search"><span className="k-visually-hidden">Buscar histórico</span><input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Ação, tipo ou ID do recurso" /></label>
      <label className="k-field"><span>De</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); }} /></label>
      <label className="k-field"><span>Até</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); }} /></label>
      <button className="k-button k-button--primary" disabled={loading} type="submit">Filtrar</button>
      {(search || from || to) ? <button className="k-button" disabled={loading} type="button" onClick={() => { void load(1, true); }}>Limpar</button> : null}
    </form>
    {error ? <div className="k-inline-state k-inline-state--error"><span>{error}</span></div> : null}
    {!error && !data.items.length ? <div className="k-inline-state">Nenhum evento encontrado.</div> : null}
    {!error && data.items.length ? <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Data</th><th>Ação</th><th>Recurso</th><th>Responsável</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td><strong>{actionLabel(item.action)}</strong></td><td>{item.resourceType}<div className="k-row__meta">{item.resourceId ?? "—"}</div></td><td>{item.actorUserId ?? "Sistema"}</td></tr>)}</tbody></table></div> : null}
    {data.total > 0 ? <div className="k-pagination"><span>Página {data.page} de {pages}</span><div><button className="k-button" type="button" disabled={loading || data.page <= 1} onClick={() => { void load(data.page - 1); }}>Anterior</button><button className="k-button" type="button" disabled={loading || data.page >= pages} onClick={() => { void load(data.page + 1); }}>Próxima</button></div></div> : null}
  </section>;
}
