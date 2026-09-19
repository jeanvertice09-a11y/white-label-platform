import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MasterEmptyState, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { masterDate } from "../components/master/format.ts";
import { MasterWhiteLabelCreateForm } from "../features/master/master-white-label-create-form.tsx";
import { listMasterWhiteLabels } from "../lib/server/master-white-label.functions.ts";
import type { MasterWhiteLabelListResult } from "../lib/server/master-white-label.types.ts";

export const Route = createFileRoute("/master/platforms")({
  loader: () => listMasterWhiteLabels({ data: { page: 1, pageSize: 20, search: "", status: "all" } }),
  component: MasterPlatforms,
});

function MasterPlatforms(): React.JSX.Element {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<MasterWhiteLabelListResult>(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "trial" | "active" | "suspended">("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(page: number): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      setData(await listMasterWhiteLabels({ data: { search, status, page, pageSize: 20 } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao listar White Labels.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="master-stack console-page">
      <MasterPageHeader
        title="White Labels"
        description="Cadastre, localize e acompanhe as plataformas operadas pela Kataluu."
        action={<span className="console-context-note">{data.total} registradas</span>}
      />
      <MasterWhiteLabelCreateForm />
      <MasterPanel title="Plataformas cadastradas">
        <form className="console-toolbar" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
          <div className="console-toolbar__field console-toolbar__field--search">
            <label htmlFor="wl-search">Buscar</label>
            <input id="wl-search" value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Nome ou slug" />
          </div>
          <div className="console-toolbar__field">
            <label htmlFor="wl-status">Status</label>
            <select id="wl-status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); }}>
              <option value="all">Todos</option>
              <option value="trial">Trial</option>
              <option value="active">Ativas</option>
              <option value="suspended">Suspensas</option>
            </select>
          </div>
          <button className="k-button" disabled={busy} type="submit">Aplicar filtros</button>
        </form>
        {message ? <div className="k-status" role="status">{message}</div> : null}
        {data.items.length ? (
          <>
            <div className="master-table-wrap">
              <table className="master-table">
                <thead><tr><th>White Label</th><th>Status</th><th>Responsável</th><th>Lojas</th><th>Domínios</th><th>Criada em</th></tr></thead>
                <tbody>{data.items.map((tenant) => (
                  <tr key={tenant.id}>
                    <td><a href={`/master/platforms/${tenant.id}`}><strong>{tenant.name}</strong></a><small>{tenant.slug}</small></td>
                    <td><span className="console-status">{tenant.status}</span></td>
                    <td>{tenant.ownerEmail ?? tenant.ownerUserId ?? "—"}</td>
                    <td>{tenant.storeCount}</td>
                    <td>{tenant.domainCount}</td>
                    <td>{masterDate(tenant.createdAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="console-pagination" aria-label="Paginação">
              <button className="k-button" disabled={busy || data.page <= 1} onClick={() => { void load(data.page - 1); }} type="button">Anterior</button>
              <span>Página {data.page} de {data.pageCount} · {data.total} registros</span>
              <button className="k-button" disabled={busy || data.page >= data.pageCount} onClick={() => { void load(data.page + 1); }} type="button">Próxima</button>
            </div>
          </>
        ) : <MasterEmptyState title="Nenhuma White Label encontrada" description="Ajuste os filtros ou cadastre uma nova plataforma." />}
      </MasterPanel>
    </div>
  );
}
