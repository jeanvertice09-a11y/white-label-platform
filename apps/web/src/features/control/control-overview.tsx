import type { ReactNode } from "react";
import type { TenantBillingWorkspace } from "../../lib/server/tenant-billing.types.ts";
import { statusLabel } from "../../lib/ui-labels.ts";
import { ControlPageHeader } from "./control-page-header.tsx";
import { useControlShellData } from "./control-shell.tsx";

function money(cents: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function date(value: string | null): string { return value ? new Date(value).toLocaleDateString("pt-BR") : "—"; }

function SummaryItem(props: Readonly<{ label: string; value: ReactNode; detail: string }>): React.JSX.Element {
  return <div className="control-summary-item"><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></div>;
}

function OperationAttention(props: Readonly<{ pastDue: number; pendingPayments: number; suspendedStores: number; pendingDomains: number }>): React.JSX.Element {
  const rows = [["Assinaturas em atraso", "Pagamento atrasado", props.pastDue], ["Pagamentos pendentes", "Aguardando confirmação", props.pendingPayments], ["Lojas suspensas", "Acesso comercial suspenso", props.suspendedStores], ["Domínios pendentes", "Aguardando ativação", props.pendingDomains]] as const;
  return <section className="control-editorial-section control-operations-panel"><div className="control-editorial-section__header"><div><h2>Situação da operação</h2><p>Itens que merecem acompanhamento agora.</p></div></div><div className="console-fact-list">{rows.map(([label, detail, value]) => <div className="console-fact-row" key={label}><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>)}</div></section>;
}

function RecentStores(): React.JSX.Element {
  const data = useControlShellData();
  return <section className="control-editorial-section control-recent-panel"><div className="control-editorial-section__header"><div><h2>Lojas recentes</h2><p>Uma leitura rápida da base atual.</p></div></div>{data.stores.length ? <div className="console-compact-list">{data.stores.slice(0, 5).map((store) => <div className="console-compact-row" key={store.id}><div><strong>{store.name}</strong><small>{store.slug} · {String(store.memberCount)} membro(s)</small></div><span>{statusLabel(store.status)}</span></div>)}</div> : <div className="control-empty"><strong>Nenhuma loja ainda</strong><p>Cadastre o primeiro lojista para começar a operação.</p></div>}</section>;
}

export function ControlOverview({ billing }: Readonly<{ billing: TenantBillingWorkspace }>): React.JSX.Element {
  const data = useControlShellData();
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const pendingDomains = data.domains.filter((item) => item.status !== "active").length;
  const context = <><span className="console-status">{statusLabel(data.tenant.status)}</span><small>{data.tenant.trialEndsAt ? `Período de teste até ${date(data.tenant.trialEndsAt)}` : data.tenant.slug}</small></>;
  return <section className="control-section control-overview">
    <ControlPageHeader kicker={data.tenant.name} title="Visão geral" description="Acompanhe lojas, assinaturas, receita e canais da sua White Label." aside={context} />
    <section className="control-overview-band" aria-label="Resumo da White Label"><div className="control-overview-primary"><span>Receita capturada</span><strong>{money(billing.metrics.revenueCapturedCents)}</strong><small>{String(billing.metrics.paymentsCaptured)} pagamento(s) de lojistas confirmado(s)</small></div><div className="control-overview-stats"><SummaryItem label="Lojas" value={data.stores.length} detail={`${String(activeStores)} ativas`} /><SummaryItem label="Assinaturas" value={billing.total} detail={`${String(billing.metrics.subscriptionsActive)} ativas · ${String(billing.metrics.subscriptionsTrialing)} em teste`} /><SummaryItem label="Domínios" value={data.domains.length} detail={`${String(data.domains.length - pendingDomains)} ativos`} /></div></section>
    <div className="control-dashboard-columns"><OperationAttention pastDue={billing.metrics.subscriptionsPastDue} pendingPayments={billing.metrics.paymentsPending} suspendedStores={data.stores.filter((item) => item.status === "suspended").length} pendingDomains={pendingDomains} /><RecentStores /></div>
  </section>;
}
