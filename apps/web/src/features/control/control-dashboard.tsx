import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { DashboardIcon, type DashboardIconName } from "../../components/dashboard/DashboardIcon.tsx";
import { signOut } from "../../lib/supabase-client.ts";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";

type ControlData = TenantControlDashboardData;
type NavigationItem = Readonly<{ href: string; label: string; icon: DashboardIconName }>;

const navigation: readonly NavigationItem[] = [
  { href: "#overview", label: "Visão geral", icon: "home" },
  { href: "#tenant-billing", label: "Faturamento", icon: "billing" },
  { href: "#merchant-management", label: "Lojistas", icon: "store" },
  { href: "#plan-management", label: "Planos", icon: "subscriptions" },
  { href: "#branding", label: "Branding", icon: "palette" },
  { href: "#domain-management", label: "Domínios", icon: "domains" },
  { href: "#gateway-management", label: "Gateways", icon: "integrations" },
];

function money(cents: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function date(value: string): string { return value ? new Date(value).toLocaleDateString("pt-BR") : "—"; }

function ControlSidebarAccount({ data }: Readonly<{ data: ControlData }>): React.JSX.Element {
  const navigate = useNavigate();
  async function handleLogout(): Promise<void> {
    try { await signOut(); }
    finally { await navigate({ to: "/login" }); }
  }
  return <div className="control-sidebar__account">
    <span className="control-sidebar__avatar" aria-hidden="true">{data.tenant.name.slice(0, 1).toUpperCase()}</span>
    <div><strong>{data.tenant.slug}</strong><small>{data.tenant.status}</small></div>
    <button type="button" className="control-sidebar__logout" onClick={() => { void handleLogout(); }} aria-label="Sair da conta" title="Sair"><DashboardIcon name="logout" /></button>
  </div>;
}

function ControlSidebar(props: Readonly<{ data: ControlData; open: boolean; activeHref: string; onClose: () => void; onNavigate: (href: string) => void }>) {
  return <>
    <button type="button" className={props.open ? "control-overlay is-open" : "control-overlay"} onClick={props.onClose} aria-label="Fechar menu" />
    <aside className={props.open ? "control-sidebar is-open" : "control-sidebar"} aria-label="Navegação da White Label">
      <div className="control-brand"><span className="control-brand__mark" aria-hidden="true">{props.data.tenant.name.slice(0, 1).toUpperCase()}</span><div><strong>{props.data.tenant.name}</strong><small>Operação da White Label</small></div></div>
      <nav className="control-nav" aria-label="Áreas do painel"><div className="console-nav-group">
        <span className="console-nav-group__label">Gestão</span>
        {navigation.map((item) => {
          const active = props.activeHref === item.href;
          return <a href={item.href} key={item.href} data-active={active ? "true" : undefined} aria-current={active ? "page" : undefined} onClick={() => { props.onNavigate(item.href); props.onClose(); }}><DashboardIcon name={item.icon} /><span>{item.label}</span></a>;
        })}
      </div></nav>
      <ControlSidebarAccount data={props.data} />
    </aside>
  </>;
}

function SummaryItem(props: Readonly<{ label: string; value: ReactNode; detail: string }>) {
  return <div className="control-summary-item"><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></div>;
}

function OperationAttention(props: Readonly<{ pastDue: number; pendingPayments: number; suspendedStores: number; pendingDomains: number }>): React.JSX.Element {
  const rows = [["Assinaturas em atraso", "Status past_due", props.pastDue], ["Pagamentos pendentes", "Aguardando confirmação", props.pendingPayments], ["Lojas suspensas", "Fora do status ativo", props.suspendedStores], ["Domínios pendentes", "Ainda não ativos", props.pendingDomains]] as const;
  return <section className="control-editorial-section control-operations-panel">
    <div className="control-editorial-section__header"><div><h2>Situação da operação</h2><p>Itens que merecem acompanhamento agora.</p></div></div>
    <div className="console-fact-list">{rows.map(([label, detail, value]) => <div className="console-fact-row" key={label}><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>)}</div>
  </section>;
}

function RecentStores({ data }: Readonly<{ data: ControlData }>): React.JSX.Element {
  return <section className="control-editorial-section control-recent-panel">
    <div className="control-editorial-section__header"><div><h2>Lojas recentes</h2><p>Uma leitura rápida da base atual.</p></div></div>
    {data.stores.length ? <div className="console-compact-list">{data.stores.slice(0, 5).map((store) => <div className="console-compact-row" key={store.id}><div><strong>{store.name}</strong><small>{store.slug} · {String(store.memberCount)} membros</small></div><span>{store.status}</span></div>)}</div> : <div className="control-empty"><strong>Nenhuma loja ainda</strong><p>Cadastre o primeiro lojista para começar a operação.</p></div>}
  </section>;
}

function RecentPayments({ data }: Readonly<{ data: ControlData }>): React.JSX.Element {
  return <section className="control-editorial-section control-finance-snapshot">
    <div className="control-editorial-section__header"><div><h2>Pagamentos recentes</h2><p>Movimentações registradas para esta White Label.</p></div><a href="#tenant-billing">Ver faturamento</a></div>
    {data.payments.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Data</th><th>Nível</th><th>Status</th><th>Valor</th></tr></thead><tbody>{data.payments.slice(0, 6).map((item) => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.level}</td><td><span className="control-badge">{item.status}</span></td><td className="console-money">{money(item.amountCents)}</td></tr>)}</tbody></table></div> : <div className="control-empty"><strong>Sem pagamentos registrados</strong><p>As movimentações financeiras aparecerão aqui quando existirem.</p></div>}
  </section>;
}

function Overview({ data }: Readonly<{ data: ControlData }>) {
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const activeSubscriptions = data.subscriptions.filter((item) => item.status === "active").length;
  const trialSubscriptions = data.subscriptions.filter((item) => item.status === "trialing").length;
  const paidPayments = data.payments.filter((item) => item.status === "paid");
  const paid = paidPayments.reduce((sum, item) => sum + item.amountCents, 0);
  const pendingDomains = data.domains.filter((item) => item.status !== "active").length;
  return <section className="control-section control-overview" id="overview">
    <div className="control-page-header"><div><span className="console-page-kicker">{data.tenant.name}</span><h1>Operação</h1><p>Lojas, assinaturas, receita e infraestrutura da White Label em uma leitura única.</p></div><div className="control-page-context"><span className="console-status">{data.tenant.status}</span><small>{data.tenant.slug}</small></div></div>
    <section className="control-overview-band" aria-label="Resumo operacional"><div className="control-overview-primary"><span>Receita recebida</span><strong>{money(paid)}</strong><small>{String(paidPayments.length)} pagamentos confirmados</small></div><div className="control-overview-stats"><SummaryItem label="Lojas" value={data.stores.length} detail={`${String(activeStores)} ativas`} /><SummaryItem label="Assinaturas" value={data.subscriptions.length} detail={`${String(activeSubscriptions)} ativas · ${String(trialSubscriptions)} trials`} /><SummaryItem label="Domínios" value={data.domains.length} detail={`${String(data.domains.length - pendingDomains)} ativos`} /></div></section>
    <div className="control-dashboard-columns"><OperationAttention pastDue={data.subscriptions.filter((item) => item.status === "past_due").length} pendingPayments={data.payments.filter((item) => item.status === "pending").length} suspendedStores={data.stores.filter((item) => item.status === "suspended").length} pendingDomains={pendingDomains} /><RecentStores data={data} /></div>
    <RecentPayments data={data} />
  </section>;
}

function BrandingSnapshot({ data }: Readonly<{ data: ControlData }>) {
  const hasSettings = data.tenant.settings.trim().length > 0;
  return <section className="control-section control-branding-section" id="branding">
    <div className="control-section__head"><div><span className="control-kicker">Identidade</span><h2>Branding da White Label</h2><p>Referência visual atualmente persistida para esta plataforma.</p></div></div>
    <div className="control-branding-layout">
      <section className="control-branding-block"><div className="control-editorial-section__header"><div><h2>Marca</h2><p>Logo configurada no tenant.</p></div></div><div className="console-brand-preview">{data.tenant.logoUrl ? <img className="control-logo" src={data.tenant.logoUrl} alt={`Logo de ${data.tenant.name}`} /> : <div className="control-empty"><strong>Logo não configurada</strong><p>A identidade aparecerá aqui quando houver uma URL de logo persistida.</p></div>}</div></section>
      <section className="control-branding-block"><div className="control-editorial-section__header"><div><h2>Identidade visual</h2><p>Cor principal e configuração estruturada.</p></div></div><div className="console-brand-color"><span style={{ background: data.tenant.primaryColor ?? "#315efb" }} aria-hidden="true" /><div><strong>{data.tenant.primaryColor ?? "Não configurada"}</strong><small>{hasSettings ? "Configuração persistida" : "Sem configurações adicionais"}</small></div></div><details className="console-disclosure"><summary>Ver configuração estruturada</summary><pre className="control-json">{hasSettings ? data.tenant.settings : "{}"}</pre></details></section>
    </div>
  </section>;
}

export function ControlDashboard({ data, children }: Readonly<{ data: ControlData; children: ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#overview");
  return <div className="control-shell console-shell">
    <a className="console-skip-link" href="#control-content">Pular para o conteúdo</a>
    <ControlSidebar data={data} open={mobileOpen} activeHref={activeHref} onClose={() => { setMobileOpen(false); }} onNavigate={setActiveHref} />
    <main className="control-main console-shell__content">
      <div className="control-mobile-bar"><button type="button" className="control-mobile-bar__menu" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu"><DashboardIcon name="menu" /></button><div><strong>{data.tenant.name}</strong><span>Controle da White Label</span></div></div>
      <div className="control-content console-container" id="control-content" tabIndex={-1}><Overview data={data} />{children}<BrandingSnapshot data={data} /></div>
    </main>
  </div>;
}
