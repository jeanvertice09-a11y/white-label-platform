import type { CSSProperties } from "react";
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

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function ProgressRow(props: Readonly<{
  label: string;
  value: number;
  total: number;
  detail: string;
}>) {
  const progress = percent(props.value, props.total);
  return (
    <div className="master-progress-row">
      <div className="master-progress-row__head">
        <div><strong>{props.label}</strong><small>{props.detail}</small></div>
        <span>{progress}%</span>
      </div>
      <div className="master-progress"><span style={{ width: `${String(progress)}%` }} /></div>
    </div>
  );
}

function StatusDonut(props: Readonly<{ active: number; total: number }>) {
  const progress = percent(props.active, props.total);
  const style = { "--master-progress": `${String(progress)}%` } as CSSProperties;
  return (
    <div className="master-donut-wrap">
      <div className="master-donut" style={style}>
        <div><strong>{progress}%</strong><span>ativas</span></div>
      </div>
      <div className="master-donut-legend">
        <div><span className="is-active" /><strong>Ativas</strong><b>{props.active}</b></div>
        <div><span className="is-muted" /><strong>Outras</strong><b>{Math.max(0, props.total - props.active)}</b></div>
      </div>
    </div>
  );
}

function MasterMetricsSection() {
  const data = Route.useLoaderData();
  const totalStores = data.tenants.reduce((sum, tenant) => sum + tenant.storeCount, 0);
  return (
    <div className="master-metrics master-metrics--compact">
      <MasterMetricCard icon="revenue" label="Receita recebida" value={masterMoney(data.metrics.paidCents)} detail="Pagamentos confirmados" />
      <MasterMetricCard icon="platforms" label="Plataformas" value={String(data.metrics.tenants)} detail={`${String(data.metrics.activeTenants)} ativas agora`} />
      <MasterMetricCard icon="store" label="Lojas ativas" value={String(data.metrics.activeStores)} detail={`${String(totalStores)} lojas cadastradas`} />
      <MasterMetricCard icon="subscriptions" label="Assinaturas" value={String(data.metrics.activeSubscriptions)} detail="Assinaturas ativas" />
    </div>
  );
}

function MasterAnalyticsSection() {
  const data = Route.useLoaderData();
  const totalStores = data.tenants.reduce((sum, tenant) => sum + tenant.storeCount, 0);
  const totalDomains = data.domains.length;
  return (
    <div className="master-analytics-grid">
      <MasterPanel title="Panorama da plataforma">
        <div className="master-panel-headline"><div><strong>Saúde operacional</strong><span>Comparativo dos principais ativos cadastrados</span></div><span className="master-chip">Visão atual</span></div>
        <div className="master-progress-list">
          <ProgressRow label="White Labels ativas" value={data.metrics.activeTenants} total={Math.max(data.metrics.tenants, 1)} detail={`${String(data.metrics.activeTenants)} de ${String(data.metrics.tenants)}`} />
          <ProgressRow label="Lojas ativas" value={data.metrics.activeStores} total={Math.max(totalStores, 1)} detail={`${String(data.metrics.activeStores)} de ${String(totalStores)}`} />
          <ProgressRow label="Domínios ativos" value={data.metrics.activeDomains} total={Math.max(totalDomains, 1)} detail={`${String(data.metrics.activeDomains)} de ${String(totalDomains)}`} />
          <ProgressRow label="Assinaturas ativas" value={data.metrics.activeSubscriptions} total={Math.max(data.metrics.tenants, 1)} detail="Cobertura entre plataformas" />
        </div>
      </MasterPanel>
      <MasterPanel title="Status das plataformas">
        <div className="master-panel-headline master-panel-headline--tight"><div><strong>Distribuição atual</strong><span>Baseada no status real dos tenants</span></div></div>
        <StatusDonut active={data.metrics.activeTenants} total={data.metrics.tenants} />
        <div className="master-mini-stats"><div><span>Em trial</span><strong>{data.metrics.trialTenants}</strong></div><div><span>Domínios</span><strong>{data.metrics.activeDomains}</strong></div></div>
      </MasterPanel>
    </div>
  );
}

function MasterBottomSection() {
  const data = Route.useLoaderData();
  const attention = data.tenants.filter((tenant) => tenant.status !== "active").slice(0, 5);
  return (
    <div className="master-grid master-grid--two master-bottom-grid">
      <MasterPanel title="Atividade recente">
        {data.audits.length ? <div className="master-list">{data.audits.slice(0, 7).map((item) => (
          <div className="master-list__row" key={item.id}><div className="master-list__identity"><span className="master-list__dot" /><div><strong>{item.action}</strong><small>{item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ""}</small></div></div><span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span></div>
        ))}</div> : <MasterEmptyState title="Sem atividade" description="Nenhum audit_log foi registrado ainda." />}
      </MasterPanel>
      <MasterPanel title="Requer atenção">
        {attention.length ? <div className="master-list">{attention.map((tenant) => (
          <div className="master-list__row" key={tenant.id}><div className="master-list__identity"><span className="master-list__dot master-list__dot--warning" /><div><strong>{tenant.name}</strong><small>{tenant.slug}</small></div></div><span>{tenant.status}</span></div>
        ))}</div> : <MasterEmptyState title="Tudo normal" description="Nenhuma White Label fora do status ativo." />}
      </MasterPanel>
    </div>
  );
}

function MasterDashboard() {
  return (
    <div className="master-stack master-dashboard">
      <MasterPageHeader title="Visão geral" description="Acompanhe operação, plataformas, lojas, receita e infraestrutura em um único lugar." action={<span className="master-live"><i />Dados reais da plataforma</span>} />
      <MasterMetricsSection />
      <MasterAnalyticsSection />
      <MasterBottomSection />
    </div>
  );
}
