import { Link } from "@tanstack/react-router";
import { MasterEmptyState, MasterPageHeader, MasterPanel } from "../../components/master/ui.tsx";
import { masterDate } from "../../components/master/format.ts";
import { statusLabel } from "../../lib/ui-labels.ts";
import type { MasterWhiteLabelDetail } from "../../lib/server/master-white-label.types.ts";
import { MasterPlatformBillingPanel } from "./master-platform-billing-panel.tsx";
import { MasterWhiteLabelDetailForm } from "./master-white-label-detail-form.tsx";
import { MasterWhiteLabelDomainManager } from "./master-white-label-domain-manager.tsx";

export function MasterWhiteLabelDetailView({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  const owner = detail.members.find((member) => member.role === "tenant_owner");
  return <div className="master-page">
    <MasterPageHeader
      title={detail.tenant.name}
      description="Identidade, operação, cobrança e relacionamentos desta White Label."
      action={<Link className="k-button" to="/master/platforms" search={{}}>Voltar para White Labels</Link>}
    />
    <MasterPanel title="Resumo da White Label">
      <div className="master-table-wrap"><table className="master-table"><tbody>
        <Row label="Status" value={statusLabel(detail.tenant.status)} />
        <Row label="Slug" value={detail.tenant.slug} />
        <Row label="Responsável" value={owner?.email ?? owner?.userId ?? "—"} />
        <Row label="Criada em" value={masterDate(detail.tenant.createdAt)} />
        <Row label="Atualizada em" value={masterDate(detail.tenant.updatedAt)} />
        <Row label="Fim do trial" value={detail.tenant.trialEndsAt ? masterDate(detail.tenant.trialEndsAt) : "—"} />
      </tbody></table></div>
    </MasterPanel>
    <MasterWhiteLabelDetailForm detail={detail} />
    <MasterPlatformBillingPanel detail={detail} />
    <CommercialPlans detail={detail} />
    <Stores detail={detail} />
    <Members detail={detail} />
    <MasterWhiteLabelDomainManager detail={detail} />
    <Templates detail={detail} />
    <Audit detail={detail} />
  </div>;
}

function CommercialPlans({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Planos comerciais da White Label">
    {detail.commercialPlans.length ? <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Plano</th><th>Template</th><th>Status</th></tr></thead><tbody>{detail.commercialPlans.map((plan) => <tr key={plan.id}><td><strong>{plan.name}</strong><div>{plan.slug}</div></td><td>{plan.templateName}</td><td>{plan.active ? "Ativo" : "Inativo"}</td></tr>)}</tbody></table></div> : <MasterEmptyState title="Sem planos comerciais" description="Esta White Label ainda não possui planos comerciais configurados." />}
  </MasterPanel>;
}

function Stores({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Lojas">
    {detail.stores.length ? <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Loja</th><th>Status</th><th>Responsável</th><th>Membros</th><th>Criada em</th></tr></thead><tbody>{detail.stores.map((store) => <tr key={store.id}><td><strong>{store.name}</strong><div>{store.slug}</div></td><td>{statusLabel(store.status)}</td><td>{store.ownerEmail ?? store.ownerUserId ?? "—"}</td><td>{store.memberCount}</td><td>{masterDate(store.createdAt)}</td></tr>)}</tbody></table></div> : <MasterEmptyState title="Sem lojas" description="Nenhuma loja pertence a esta White Label." />}
  </MasterPanel>;
}

function Members({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Usuários e memberships">
    {detail.members.length ? <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Vínculo criado</th></tr></thead><tbody>{detail.members.map((member) => <tr key={`${member.userId}-${member.role}`}><td>{member.email ?? member.userId}</td><td>{statusLabel(member.role)}</td><td>{masterDate(member.createdAt)}</td></tr>)}</tbody></table></div> : <MasterEmptyState title="Sem memberships" description="Nenhum usuário está vinculado a esta White Label." />}
  </MasterPanel>;
}

function Templates({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Templates Kataluu">
    {detail.planTemplates.length ? <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Template</th><th>Status</th><th>Entitlements</th></tr></thead><tbody>{detail.planTemplates.map((template) => <tr key={template.id}><td><strong>{template.name}</strong><div>{template.code}</div></td><td>{template.active ? "Ativo" : "Inativo"}</td><td>{template.entitlementCount}</td></tr>)}</tbody></table></div> : <MasterEmptyState title="Sem templates" description="Nenhum template de plano está configurado na plataforma." />}
    <p><Link className="k-text-action" to="/master/settings">Gerenciar entitlements dos templates →</Link></p>
  </MasterPanel>;
}

function Audit({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  return <MasterPanel title="Auditoria relacionada">
    {detail.audits.length ? <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Quando</th><th>Ação</th><th>Recurso</th><th>Ator</th></tr></thead><tbody>{detail.audits.map((audit) => <tr key={audit.id}><td>{masterDate(audit.createdAt)}</td><td>{audit.action}</td><td>{audit.resourceType}{audit.resourceId ? ` · ${audit.resourceId}` : ""}</td><td>{audit.actorUserId ?? "Sistema"}</td></tr>)}</tbody></table></div> : <MasterEmptyState title="Sem auditoria" description="Nenhum evento de auditoria foi encontrado para esta White Label." />}
  </MasterPanel>;
}

function Row({ label, value }: Readonly<{ label: string; value: string }>): React.JSX.Element {
  return <tr><th>{label}</th><td>{value}</td></tr>;
}
