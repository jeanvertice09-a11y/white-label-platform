import { createFileRoute } from "@tanstack/react-router";
import { MasterMetricCard, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { MasterPlatformBillingPanel } from "../features/master/master-platform-billing-panel.tsx";
import { MasterWhiteLabelDetailForm } from "../features/master/master-white-label-detail-form.tsx";
import { MasterWhiteLabelDomainManager } from "../features/master/master-white-label-domain-manager.tsx";
import { getMasterWhiteLabel } from "../lib/server/master-white-label.functions.ts";
import type { MasterWhiteLabelDetail } from "../lib/server/master-white-label.types.ts";

export const Route = createFileRoute("/master/platforms/$tenantId")({
  loader: async (context) => {
    const params = context.params as Record<string, string>;
    const detail = await getMasterWhiteLabel({ data: { tenantId: params["tenantId"] ?? "" } });
    if (!detail) throw new Error("White Label não encontrada.");
    return detail;
  },
  component: MasterWhiteLabelDetailPage,
});

function dateTime(value: string): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

function WhiteLabelSummary({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  const activeStores = detail.stores.filter((item) => item.status === "active").length;
  const activeDomains = detail.domains.filter((item) => item.status === "active").length;
  return <div className="master-metrics master-summary-surface" aria-label="Resumo da White Label">
    <MasterMetricCard icon="platforms" label="Status" value={detail.tenant.status} detail="Situação da plataforma" />
    <MasterMetricCard icon="store" label="Lojas" value={String(detail.stores.length)} detail={`${String(activeStores)} ativas`} />
    <MasterMetricCard icon="support" label="Membros" value={String(detail.members.length)} detail="Acessos vinculados" />
    <MasterMetricCard icon="domains" label="Domínios" value={String(detail.domains.length)} detail={`${String(activeDomains)} ativos`} />
  </div>;
}

function StoresPanel({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Lojas do tenant">
    {detail.stores.length ? <div className="master-table-wrap"><table className="master-table">
      <thead><tr><th>Loja</th><th>Owner</th><th>Membros</th><th>Status</th><th>Criada em</th></tr></thead>
      <tbody>{detail.stores.map((store) => <tr key={store.id}>
        <td><strong>{store.name}</strong><small>{store.slug}</small></td>
        <td>{store.ownerEmail ?? store.ownerUserId ?? "—"}</td><td>{store.memberCount}</td>
        <td><span className="console-status">{store.status}</span></td><td>{dateTime(store.createdAt)}</td>
      </tr>)}</tbody>
    </table></div> : <p className="console-panel-note">Nenhuma loja pertencente a esta White Label.</p>}
  </MasterPanel>;
}

function MembersAndTemplates({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <div className="master-grid master-grid--two">
    <MasterPanel title="Membros">
      {detail.members.length ? <div className="master-table-wrap"><table className="master-table">
        <thead><tr><th>Usuário</th><th>Role</th></tr></thead>
        <tbody>{detail.members.map((member) => <tr key={member.userId}>
          <td>{member.email ?? member.userId}</td><td><span className="console-status">{member.role}</span></td>
        </tr>)}</tbody>
      </table></div> : <p className="console-panel-note">Nenhum membership registrado para este tenant.</p>}
    </MasterPanel>
    <MasterPanel title="Templates comerciais">
      <div className="master-table-wrap"><table className="master-table">
        <thead><tr><th>Template Kataluu</th><th>Status</th><th>Entitlements</th></tr></thead>
        <tbody>{detail.planTemplates.map((template) => <tr key={template.id}>
          <td><strong>{template.name}</strong><small>{template.code}</small></td>
          <td><span className="console-status">{template.active ? "Ativo" : "Inativo"}</span></td><td>{template.entitlementCount}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="console-panel-note">{detail.commercialPlans.length ? `Planos configurados: ${detail.commercialPlans.map((plan) => plan.name).join(", ")}` : "Nenhum plano comercial de lojista configurado."}</p>
    </MasterPanel>
  </div>;
}

function AuditPanel({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Auditoria recente">
    {detail.audits.length ? <div className="master-table-wrap"><table className="master-table">
      <thead><tr><th>Data</th><th>Ação</th><th>Recurso</th><th>Ator</th></tr></thead>
      <tbody>{detail.audits.map((item) => <tr key={item.id}>
        <td>{dateTime(item.createdAt)}</td><td><strong>{item.action}</strong></td>
        <td>{item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ""}</td><td>{item.actorUserId ?? "Sistema"}</td>
      </tr>)}</tbody>
    </table></div> : <p className="console-panel-note">Nenhum evento de auditoria encontrado para esta White Label.</p>}
  </MasterPanel>;
}

function MasterWhiteLabelDetailPage(): React.JSX.Element {
  const detail: MasterWhiteLabelDetail = Route.useLoaderData();
  return <div className="master-stack console-page">
    <MasterPageHeader title={detail.tenant.name} description={`${detail.tenant.slug} · gestão da White Label e suas configurações comerciais.`} action={<a className="k-button" href="/master/platforms">Voltar para White Labels</a>} />
    <WhiteLabelSummary detail={detail} />
    <section className="console-detail-section" aria-labelledby="wl-config-title">
      <div className="console-section-heading"><span>Configuração</span><h2 id="wl-config-title">Identidade e operação</h2><p>Dados gerais, responsável e status operacional da White Label.</p></div>
      <MasterWhiteLabelDetailForm detail={detail} />
    </section>
    <section className="console-detail-section" aria-labelledby="wl-billing-title">
      <div className="console-section-heading"><span>Comercial</span><h2 id="wl-billing-title">Billing Kataluu → White Label</h2><p>Plano, período, trial e pagamentos da plataforma.</p></div>
      <MasterPlatformBillingPanel detail={detail} />
    </section>
    <section className="console-detail-section" aria-labelledby="wl-domains-title">
      <div className="console-section-heading"><span>Domínios</span><h2 id="wl-domains-title">Endereços e verificação</h2><p>Domínios vinculados e estado da configuração DNS.</p></div>
      <MasterWhiteLabelDomainManager detail={detail} />
    </section>
    <StoresPanel detail={detail} />
    <MembersAndTemplates detail={detail} />
    <AuditPanel detail={detail} />
  </div>;
}
