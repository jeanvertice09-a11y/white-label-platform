import { createFileRoute } from "@tanstack/react-router";
import { MasterEmptyState, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { masterDate } from "../components/master/format.ts";
import { getMasterConsoleData } from "../lib/server/platform-console.functions.ts";

export const Route = createFileRoute("/master/platforms")({
  loader: () => getMasterConsoleData(),
  component: MasterPlatforms,
});

function MasterPlatforms() {
  const data = Route.useLoaderData();
  return (
    <div className="master-stack">
      <MasterPageHeader title="Plataformas" description="White Labels reais conectadas à Kataluu." />
      <MasterPanel title="White Labels">
        {data.tenants.length ? (
          <div className="master-table-wrap"><table className="master-table">
            <thead><tr><th>Plataforma</th><th>Status</th><th>Lojas</th><th>Plano</th><th>Assinatura</th><th>Criada em</th></tr></thead>
            <tbody>{data.tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td><strong>{tenant.name}</strong><small>{tenant.slug}</small></td>
                <td>{tenant.status}</td>
                <td>{tenant.activeStoreCount}/{tenant.storeCount} ativas</td>
                <td>{tenant.planName ?? "—"}</td>
                <td>{tenant.subscriptionStatus ?? "—"}</td>
                <td>{masterDate(tenant.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <MasterEmptyState title="Nenhuma White Label" description="A tabela tenants ainda não possui registros." />}
      </MasterPanel>
    </div>
  );
}
