import { createFileRoute } from "@tanstack/react-router";
import { MasterEmptyState, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { masterDate } from "../components/master/format.ts";
import { getMasterConsoleData } from "../lib/server/platform-console.functions.ts";

export const Route = createFileRoute("/master/audit")({
  loader: () => getMasterConsoleData(),
  component: MasterAudit,
});

function MasterAudit() {
  const data = Route.useLoaderData();
  return (
    <div className="master-stack">
      <MasterPageHeader title="Auditoria" description="Eventos reais registrados em audit_logs." />
      <MasterPanel title="Eventos recentes">
        {data.audits.length ? <div className="master-table-wrap"><table className="master-table">
          <thead><tr><th>Ação</th><th>Recurso</th><th>Tenant</th><th>Ator</th><th>Data</th></tr></thead>
          <tbody>{data.audits.map((item) => (
            <tr key={item.id}>
              <td>{item.action}</td>
              <td><strong>{item.resourceType}</strong><small>{item.resourceId ?? "—"}</small></td>
              <td>{item.tenantId ?? "—"}</td>
              <td>{item.actorUserId ?? "—"}</td>
              <td>{masterDate(item.createdAt)}</td>
            </tr>
          ))}</tbody>
        </table></div> : <MasterEmptyState title="Sem eventos" description="Nenhum audit_log foi persistido ainda." />}
      </MasterPanel>
    </div>
  );
}
