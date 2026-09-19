import { createFileRoute } from "@tanstack/react-router";
import { MasterEmptyState, MasterMetricCard, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { getMasterConsoleData } from "../lib/server/platform-console.functions.ts";

export const Route = createFileRoute("/master/infrastructure")({
  loader: () => getMasterConsoleData(),
  component: MasterInfrastructure,
});

function MasterInfrastructure() {
  const data = Route.useLoaderData();
  const pendingDomains = data.domains.filter((domain) => domain.status === "pending").length;
  return (
    <div className="master-stack console-page">
      <MasterPageHeader title="Infraestrutura" description="Domínios e integrações registradas na plataforma, sem indicadores sintéticos." />
      <div className="master-metrics master-summary-surface" aria-label="Resumo da infraestrutura">
        <MasterMetricCard icon="domains" label="Domínios ativos" value={String(data.metrics.activeDomains)} detail="Status active" />
        <MasterMetricCard icon="activity" label="Domínios pendentes" value={String(pendingDomains)} detail="Aguardando verificação" />
        <MasterMetricCard icon="integrations" label="Gateways" value={String(data.gateways.length)} detail="Contas registradas" />
        <MasterMetricCard icon="platforms" label="White Labels" value={String(data.metrics.tenants)} detail="Plataformas cadastradas" />
      </div>
      <MasterPanel title="Domínios recentes">
        {data.domains.length ? <div className="master-table-wrap"><table className="master-table">
          <thead><tr><th>Hostname</th><th>Tipo</th><th>Status</th><th>Tenant</th><th>Store</th></tr></thead>
          <tbody>{data.domains.map((domain) => (
            <tr key={domain.id}><td><strong>{domain.hostname}</strong></td><td>{domain.type}</td><td><span className="console-status">{domain.status}</span></td><td>{domain.tenantId}</td><td>{domain.storeId ?? "—"}</td></tr>
          ))}</tbody>
        </table></div> : <MasterEmptyState title="Sem domínios" description="Nenhum domínio foi cadastrado." />}
      </MasterPanel>
      <MasterPanel title="Gateways">
        {data.gateways.length ? <div className="master-list">{data.gateways.map((gateway) => (
          <div className="master-list__row" key={gateway.id}><div><strong>{gateway.label}</strong><small>{gateway.level}</small></div><span>{gateway.provider}</span></div>
        ))}</div> : <MasterEmptyState title="Sem gateways" description="Nenhuma conta de gateway foi configurada." />}
      </MasterPanel>
    </div>
  );
}
