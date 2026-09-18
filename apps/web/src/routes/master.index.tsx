import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterMetricCard,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";
import { masterMoney } from "../components/master/format.ts";
import { getMasterConsoleData } from "../lib/server/platform-console.functions.ts";

export const Route = createFileRoute("/master/")({
  loader: () => getMasterConsoleData(),
  component: MasterDashboard,
});

function MasterDashboard() {
  const data = Route.useLoaderData();
  const attention = data.tenants.filter((tenant) => tenant.status !== "active").slice(0, 6);
  return (
    <div className="master-stack">
      <MasterPageHeader title="Visão geral" description="Resumo operacional real da plataforma Kataluu." />
      <div className="master-metrics">
        <MasterMetricCard icon="revenue" label="Receita recebida" value={masterMoney(data.metrics.paidCents)} detail="Pagamentos platform_billing com status paid" />
        <MasterMetricCard icon="platforms" label="Plataformas" value={String(data.metrics.tenants)} detail={`${String(data.metrics.activeTenants)} ativas`} />
        <MasterMetricCard icon="store" label="Lojas ativas" value={String(data.metrics.activeStores)} detail="Stores com status active" />
        <MasterMetricCard icon="activity" label="Em trial" value={String(data.metrics.trialTenants)} detail="Tenants em período de teste" />
        <MasterMetricCard icon="subscriptions" label="Assinaturas ativas" value={String(data.metrics.activeSubscriptions)} detail="Nível platform_billing" />
        <MasterMetricCard icon="domains" label="Domínios ativos" value={String(data.metrics.activeDomains)} detail="Fonte: domains" />
      </div>
      <div className="master-grid master-grid--two">
        <MasterPanel title="Atividade recente">
          {data.audits.length ? <div className="master-list">{data.audits.slice(0, 8).map((item) => (
            <div className="master-list__row" key={item.id}><div><strong>{item.action}</strong><small>{item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ""}</small></div><span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span></div>
          ))}</div> : <MasterEmptyState title="Sem atividade" description="Nenhum audit_log foi registrado ainda." />}
        </MasterPanel>
        <MasterPanel title="Requer atenção">
          {attention.length ? <div className="master-list">{attention.map((tenant) => (
            <div className="master-list__row" key={tenant.id}><div><strong>{tenant.name}</strong><small>{tenant.slug}</small></div><span>{tenant.status}</span></div>
          ))}</div> : <MasterEmptyState title="Tudo normal" description="Nenhuma White Label fora do status ativo." />}
        </MasterPanel>
      </div>
    </div>
  );
}
