import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ControlOperationalHealth } from "../../lib/server/control-operational-health.functions.ts";
import type { StorefrontAnalyticsSummary } from "../../lib/server/storefront-analytics.functions.ts";
import type { TenantBillingWorkspace } from "../../lib/server/tenant-billing.types.ts";
import { statusLabel } from "../../lib/ui-labels.ts";
import { retryControlOperationalJobAction } from "../../lib/server/control-operational-jobs.functions.ts";
import { ControlPageHeader } from "./control-page-header.tsx";
import { useControlShellData } from "./control-shell.tsx";

function money(cents: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function date(value: string | null): string { return value ? new Date(value).toLocaleDateString("pt-BR") : "—"; }
function percent(value: number): string { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value) + "%"; }

function SummaryItem(props: Readonly<{ label: string; value: ReactNode; detail: string }>): React.JSX.Element {
  return <div className="control-summary-item"><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></div>;
}

function TenantAnalytics({ analytics }: Readonly<{ analytics: StorefrontAnalyticsSummary }>): React.JSX.Element {
  const rows = [
    ["Visitas", analytics.visits, "sessões de catálogo"],
    ["Produtos vistos", analytics.productViews, "visualizações persistidas"],
    ["Add-to-cart", analytics.addToCart, "ações persistidas"],
    ["Checkouts", analytics.checkoutStarts, "sessões que iniciaram checkout"],
    ["Pedidos", analytics.orders, `${percent(analytics.conversionRate)} de conversão`],
  ] as const;
  return <section className="control-editorial-section"><div className="control-editorial-section__header"><div><h2>Conversão das lojas · 30 dias</h2><p>Analytics interno agregado do tenant, independente de pixels externos.</p></div></div><div className="console-fact-list">{rows.map(([label, value, detail]) => <div className="console-fact-row" key={label}><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>)}</div></section>;
}

function OperationAttention(props: Readonly<{
  pastDue: number;
  pendingPayments: number;
  suspendedStores: number;
  pendingDomains: number;
  health: ControlOperationalHealth;
}>): React.JSX.Element {
  const rows = [
    ["Assinaturas em atraso", "Pagamento atrasado", props.pastDue],
    ["Pagamentos pendentes", "Aguardando confirmação", props.pendingPayments],
    ["Lojas suspensas", "Acesso comercial suspenso", props.suspendedStores],
    ["Domínios pendentes", "Aguardando ativação", props.pendingDomains],
    ["Webhooks em dead-letter", "Falha permanente após tentativas", props.health.webhookDeadLetters],
    ["Webhooks em retry", "Nova tentativa agendada", props.health.webhookRetries],
    ["Webhooks travados", "Processing há mais de 5 minutos", props.health.webhookStaleProcessing],
    ["Pagamentos inconsistentes", "Status do gateway diverge do pedido", props.health.paymentInconsistencies],
    ["Domínios suspensos", "Domínio impedido de resolver", props.health.suspendedDomains],
    ["Domínios pendentes > 24h", "Sem verificação concluída", props.health.stalledPendingDomains],
    ["Jobs em retry", "Tarefas operacionais aguardando nova tentativa", props.health.jobRetries],
    ["Jobs em dead-letter", "Tarefas que esgotaram as tentativas", props.health.jobDeadLetters],
    ["Jobs com lease vencida", "Worker interrompido; serão recuperados", props.health.jobStaleRunning],
  ] as const;
  return <section className="control-editorial-section control-operations-panel"><div className="control-editorial-section__header"><div><h2>Situação da operação</h2><p>Itens reais do banco que merecem acompanhamento agora.</p></div></div><div className="console-fact-list">{rows.map(([label, detail, value]) => <div className="console-fact-row" key={label}><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>)}</div></section>;
}


function DeadLetterRecovery({ health }: Readonly<{ health: ControlOperationalHealth }>): React.JSX.Element | null {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (health.deadLetterJobs.length === 0) return null;
  async function retry(jobId: string): Promise<void> {
    setBusyId(jobId); setMessage("");
    try {
      await retryControlOperationalJobAction({ data: { jobId } });
      setMessage("Job reenfileirado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reenfileirar o job.");
    } finally {
      setBusyId(null);
    }
  }
  return <section className="control-editorial-section"><div className="control-editorial-section__header"><div><h2>Recuperação de jobs</h2><p>Dead-letters recentes podem ser reenfileiradas com segurança por um administrador da White Label.</p></div></div><div className="console-compact-list">{health.deadLetterJobs.map((job) => <div className="console-compact-row" key={job.id}><div><strong>{job.kind}</strong><small>{job.lastError ?? "Falha sem detalhe"} · {new Date(job.createdAt).toLocaleString("pt-BR")}</small></div><button className="k-button" type="button" disabled={busyId !== null} onClick={() => { void retry(job.id); }}>{busyId === job.id ? "Reenfileirando..." : "Tentar novamente"}</button></div>)}</div>{message ? <p className="k-status" role="status">{message}</p> : null}</section>;
}

function RecentStores(): React.JSX.Element {
  const data = useControlShellData();
  return <section className="control-editorial-section control-recent-panel"><div className="control-editorial-section__header"><div><h2>Lojas recentes</h2><p>Uma leitura rápida da base atual.</p></div></div>{data.stores.length ? <div className="console-compact-list">{data.stores.slice(0, 5).map((store) => <div className="console-compact-row" key={store.id}><div><strong>{store.name}</strong><small>{store.slug} · {String(store.memberCount)} membro(s)</small></div><span>{statusLabel(store.status)}</span></div>)}</div> : <div className="control-empty"><strong>Nenhuma loja ainda</strong><p>Cadastre o primeiro lojista para começar a operação.</p></div>}</section>;
}

export function ControlOverview({ billing, health, analytics }: Readonly<{
  billing: TenantBillingWorkspace;
  health: ControlOperationalHealth;
  analytics: StorefrontAnalyticsSummary;
}>): React.JSX.Element {
  const data = useControlShellData();
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const pendingDomains = data.domains.filter((item) => item.status !== "active").length;
  const context = <><span className="console-status">{statusLabel(data.tenant.status)}</span><small>{data.tenant.trialEndsAt ? `Período de teste até ${date(data.tenant.trialEndsAt)}` : data.tenant.slug}</small></>;
  return <section className="control-section control-overview">
    <ControlPageHeader kicker={data.tenant.name} title="Visão geral" description="Acompanhe lojas, assinaturas, receita e canais da sua White Label." aside={context} />
    <section className="control-overview-band" aria-label="Resumo da White Label"><div className="control-overview-primary"><span>Receita capturada</span><strong>{money(billing.metrics.revenueCapturedCents)}</strong><small>{String(billing.metrics.paymentsCaptured)} pagamento(s) de lojistas confirmado(s)</small></div><div className="control-overview-stats"><SummaryItem label="Lojas" value={data.stores.length} detail={`${String(activeStores)} ativas`} /><SummaryItem label="Assinaturas" value={billing.total} detail={`${String(billing.metrics.subscriptionsActive)} ativas · ${String(billing.metrics.subscriptionsTrialing)} em teste`} /><SummaryItem label="Domínios" value={data.domains.length} detail={`${String(data.domains.length - pendingDomains)} ativos`} /></div></section>
    <TenantAnalytics analytics={analytics} />
    <div className="control-dashboard-columns"><OperationAttention pastDue={billing.metrics.subscriptionsPastDue} pendingPayments={billing.metrics.paymentsPending} suspendedStores={data.stores.filter((item) => item.status === "suspended").length} pendingDomains={pendingDomains} health={health} /><RecentStores /></div>
    <DeadLetterRecovery health={health} />
  </section>;
}
