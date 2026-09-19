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

function MasterOverviewBand() {
  const data = Route.useLoaderData();
  const totalStores = data.tenants.reduce((sum, tenant) => sum + tenant.storeCount, 0);
  return (
    <section className="master-overview-band" aria-label="Resumo da plataforma">
      <div className="master-overview-primary">
        <span>Receita recebida</span>
        <strong>{masterMoney(data.metrics.paidCents)}</strong>
        <small>Pagamentos confirmados em platform_billing</small>
      </div>
      <div className="master-overview-stats">
        <MasterMetricCard icon="platforms" label="White Labels" value={String(data.metrics.tenants)} detail={`${String(data.metrics.activeTenants)} ativas`} />
        <MasterMetricCard icon="store" label="Lojas" value={String(totalStores)} detail={`${String(data.metrics.activeStores)} ativas`} />
        <MasterMetricCard icon="subscriptions" label="Assinaturas" value={String(data.metrics.activeSubscriptions)} detail="Ativas na plataforma" />
      </div>
    </section>
  );
}

function OperationalSnapshot() {
  const data = Route.useLoaderData();
  const totalStores = data.tenants.reduce((sum, tenant) => sum + tenant.storeCount, 0);
  const rows = [
    ["White Labels ativas", data.metrics.activeTenants, `${String(data.metrics.tenants)} cadastradas`],
    ["Em trial", data.metrics.trialTenants, "Períodos de teste em andamento"],
    ["Lojas ativas", data.metrics.activeStores, `${String(totalStores)} cadastradas`],
    ["Domínios ativos", data.metrics.activeDomains, `${String(data.domains.length)} cadastrados`],
    ["Assinaturas ativas", data.metrics.activeSubscriptions, "Billing e trials reais"],
  ] as const;
  return (
    <section className="master-operational-section" aria-labelledby="master-operational-title">
      <div className="master-section-heading">
        <h2 id="master-operational-title">Base operacional</h2>
        <p>Leitura compacta dos volumes que sustentam a operação.</p>
      </div>
      <div className="master-operational-grid">
        {rows.map(([label, value, detail]) => (
          <div className="master-operational-item" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttentionPanel() {
  const data = Route.useLoaderData();
  const attention = data.tenants.filter((tenant) => tenant.status !== "active").slice(0, 6);
  return (
    <MasterPanel title="Operação que precisa de atenção">
      {attention.length ? (
        <div className="master-list master-attention-list">
          {attention.map((tenant) => (
            <div className="master-list__row" key={tenant.id}>
              <div className="master-list__identity">
                <span className="master-list__dot master-list__dot--warning" aria-hidden="true" />
                <div><strong>{tenant.name}</strong><small>{tenant.slug}</small></div>
              </div>
              <span>{tenant.status}</span>
            </div>
          ))}
        </div>
      ) : <MasterEmptyState title="Nenhuma ação necessária" description="Todas as White Labels listadas estão ativas." />}
    </MasterPanel>
  );
}

function ActivityPanel() {
  const data = Route.useLoaderData();
  return (
    <MasterPanel title="Atividade recente">
      {data.audits.length ? (
        <div className="master-list master-activity-list">
          {data.audits.slice(0, 8).map((item) => (
            <div className="master-list__row" key={item.id}>
              <div className="master-list__identity">
                <span className="master-list__dot" aria-hidden="true" />
                <div><strong>{item.action}</strong><small>{item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ""}</small></div>
              </div>
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("pt-BR")}</time>
            </div>
          ))}
        </div>
      ) : <MasterEmptyState title="Sem atividade registrada" description="Os eventos auditáveis aparecerão aqui quando ocorrerem." />}
    </MasterPanel>
  );
}

function MasterDashboard() {
  return (
    <div className="master-stack master-dashboard console-page">
      <MasterPageHeader
        title="Visão geral"
        description="Operação da Kataluu, White Labels e faturamento em uma leitura direta."
        action={<span className="console-context-note">Operação atual</span>}
      />
      <MasterOverviewBand />
      <div className="master-dashboard-columns">
        <AttentionPanel />
        <ActivityPanel />
      </div>
      <OperationalSnapshot />
    </div>
  );
}
