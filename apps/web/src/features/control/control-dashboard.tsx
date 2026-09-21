import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DashboardIcon, type DashboardIconName } from "../../components/dashboard/DashboardIcon.tsx";
import { roleLabel, statusLabel } from "../../lib/ui-labels.ts";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";
import type { TenantBillingWorkspace } from "../../lib/server/tenant-billing.types.ts";
import { signOut } from "../../lib/supabase-client.ts";

type ControlData = TenantControlDashboardData;
type NavigationItem = Readonly<{ href: string; label: string; icon: DashboardIconName }>;
type NavigationGroup = Readonly<{ label: string; items: readonly NavigationItem[] }>;

const navigation: readonly NavigationGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "#overview", label: "Visão geral", icon: "home" }],
  },
  {
    label: "Lojistas",
    items: [
      { href: "#merchant-management", label: "Lojas", icon: "store" },
      { href: "#tenant-billing", label: "Assinaturas e cobranças", icon: "billing" },
    ],
  },
  {
    label: "Planos",
    items: [
      { href: "#plan-management", label: "Planos comerciais", icon: "subscriptions" },
      { href: "#plan-resources", label: "Recursos e limites", icon: "check" },
    ],
  },
  {
    label: "Marca e canais",
    items: [
      { href: "#branding", label: "Identidade visual", icon: "palette" },
      { href: "#domain-management", label: "Domínios", icon: "domains" },
      { href: "#gateway-management", label: "Meios de pagamento", icon: "integrations" },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "#access", label: "Equipe e acessos", icon: "support" },
      { href: "#audit", label: "Auditoria", icon: "audit" },
    ],
  },
];

function money(cents: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function date(value: string | null): string { return value ? new Date(value).toLocaleDateString("pt-BR") : "—"; }
function dateTime(value: string): string { return value ? new Date(value).toLocaleString("pt-BR") : "—"; }
function initialControlHash(): string { return typeof window === "undefined" ? "#overview" : window.location.hash || "#overview"; }

function ControlSidebarAccount({ data }: Readonly<{ data: ControlData }>): React.JSX.Element {
  const navigate = useNavigate();
  async function handleLogout(): Promise<void> {
    try { await signOut(); }
    finally { await navigate({ to: "/login" }); }
  }
  return <div className="control-sidebar__account">
    <span className="control-sidebar__avatar" aria-hidden="true">{data.tenant.name.slice(0, 1).toUpperCase()}</span>
    <div><strong>{statusLabel(data.tenant.status)}</strong><small>{data.tenant.slug}</small></div>
    <button type="button" className="control-sidebar__logout" onClick={() => { void handleLogout(); }} aria-label="Sair da conta" title="Sair"><DashboardIcon name="logout" /></button>
  </div>;
}

function ControlSidebar(props: Readonly<{ data: ControlData; open: boolean; activeHref: string; onClose: () => void; onNavigate: (href: string) => void }>) {
  return <>
    <button type="button" className={props.open ? "control-overlay is-open" : "control-overlay"} onClick={props.onClose} aria-label="Fechar menu" />
    <aside className={props.open ? "control-sidebar is-open" : "control-sidebar"} aria-label="Navegação da White Label">
      <div className="control-brand"><span className="control-brand__mark" aria-hidden="true">{props.data.tenant.name.slice(0, 1).toUpperCase()}</span><div><strong>{props.data.tenant.name}</strong><small>Painel da White Label</small></div></div>
      <nav className="control-nav" aria-label="Áreas do painel">
        {navigation.map((group) => <div className="console-nav-group" key={group.label}>
          <span className="console-nav-group__label">{group.label}</span>
          {group.items.map((item) => {
            const active = props.activeHref === item.href;
            return <a href={item.href} key={item.href} data-active={active ? "true" : undefined} aria-current={active ? "page" : undefined} onClick={() => { props.onNavigate(item.href); props.onClose(); }}><DashboardIcon name={item.icon} /><span>{item.label}</span></a>;
          })}
        </div>)}
      </nav>
      <ControlSidebarAccount data={props.data} />
    </aside>
  </>;
}

function SummaryItem(props: Readonly<{ label: string; value: ReactNode; detail: string }>) {
  return <div className="control-summary-item"><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></div>;
}

function OperationAttention(props: Readonly<{ pastDue: number; pendingPayments: number; suspendedStores: number; pendingDomains: number }>): React.JSX.Element {
  const rows = [["Assinaturas em atraso", "Pagamento atrasado", props.pastDue], ["Pagamentos pendentes", "Aguardando confirmação", props.pendingPayments], ["Lojas suspensas", "Acesso comercial suspenso", props.suspendedStores], ["Domínios pendentes", "Aguardando ativação", props.pendingDomains]] as const;
  return <section className="control-editorial-section control-operations-panel">
    <div className="control-editorial-section__header"><div><h2>Situação da operação</h2><p>Itens que merecem acompanhamento agora.</p></div></div>
    <div className="console-fact-list">{rows.map(([label, detail, value]) => <div className="console-fact-row" key={label}><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>)}</div>
  </section>;
}

function RecentStores({ data }: Readonly<{ data: ControlData }>): React.JSX.Element {
  return <section className="control-editorial-section control-recent-panel">
    <div className="control-editorial-section__header"><div><h2>Lojas recentes</h2><p>Uma leitura rápida da base atual.</p></div></div>
    {data.stores.length ? <div className="console-compact-list">{data.stores.slice(0, 5).map((store) => <div className="console-compact-row" key={store.id}><div><strong>{store.name}</strong><small>{store.slug} · {String(store.memberCount)} membro(s)</small></div><span>{statusLabel(store.status)}</span></div>)}</div> : <div className="control-empty"><strong>Nenhuma loja ainda</strong><p>Cadastre o primeiro lojista para começar a operação.</p></div>}
  </section>;
}

function Overview({ data, billing }: Readonly<{ data: ControlData; billing: TenantBillingWorkspace }>) {
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const pendingDomains = data.domains.filter((item) => item.status !== "active").length;
  return <section className="control-section control-overview" id="overview">
    <div className="control-page-header"><div><span className="console-page-kicker">{data.tenant.name}</span><h1>Visão geral</h1><p>Acompanhe lojas, assinaturas, receita e canais da sua White Label.</p></div><div className="control-page-context"><span className="console-status">{statusLabel(data.tenant.status)}</span><small>{data.tenant.trialEndsAt ? `Período de teste até ${date(data.tenant.trialEndsAt)}` : data.tenant.slug}</small></div></div>
    <section className="control-overview-band" aria-label="Resumo da White Label"><div className="control-overview-primary"><span>Receita capturada</span><strong>{money(billing.metrics.revenueCapturedCents)}</strong><small>{String(billing.metrics.paymentsCaptured)} pagamento(s) de lojistas confirmado(s)</small></div><div className="control-overview-stats"><SummaryItem label="Lojas" value={data.stores.length} detail={`${String(activeStores)} ativas`} /><SummaryItem label="Assinaturas" value={billing.total} detail={`${String(billing.metrics.subscriptionsActive)} ativas · ${String(billing.metrics.subscriptionsTrialing)} em teste`} /><SummaryItem label="Domínios" value={data.domains.length} detail={`${String(data.domains.length - pendingDomains)} ativos`} /></div></section>
    <div className="control-dashboard-columns"><OperationAttention pastDue={billing.metrics.subscriptionsPastDue} pendingPayments={billing.metrics.paymentsPending} suspendedStores={data.stores.filter((item) => item.status === "suspended").length} pendingDomains={pendingDomains} /><RecentStores data={data} /></div>
  </section>;
}

function BrandingSnapshot({ data }: Readonly<{ data: ControlData }>) {
  const hasSettings = data.tenant.settings.trim() !== "{}";
  return <section className="control-section control-branding-section" id="branding">
    <div className="control-section__head"><div><span className="control-kicker">Marca e canais</span><h2>Identidade visual</h2><p>Confira a marca apresentada nos pontos de contato da sua White Label.</p></div></div>
    <div className="control-branding-layout">
      <section className="control-branding-block"><div className="control-editorial-section__header"><div><h2>Logo</h2><p>Imagem configurada para a White Label.</p></div></div><div className="console-brand-preview">{data.tenant.logoUrl ? <img className="control-logo" src={data.tenant.logoUrl} alt={`Logo de ${data.tenant.name}`} /> : <div className="control-empty"><strong>Logo não configurada</strong><p>Adicione uma logo na área de identidade visual.</p></div>}</div></section>
      <section className="control-branding-block"><div className="control-editorial-section__header"><div><h2>Identidade visual</h2><p>Cor principal e situação da personalização.</p></div></div><div className="console-brand-color"><span style={{ background: data.tenant.primaryColor ?? "#315efb" }} aria-hidden="true" /><div><strong>{data.tenant.primaryColor ?? "Não configurada"}</strong><small>{hasSettings ? "Personalização configurada" : "Sem configurações adicionais"}</small></div></div></section>
    </div>
  </section>;
}

function AccessAndAudit({ data }: Readonly<{ data: ControlData }>): React.JSX.Element {
  return <div className="control-dashboard-columns">
    <section className="control-editorial-section" id="access">
      <div className="control-editorial-section__header"><div><h2>Equipe e acessos</h2><p>Pessoas com acesso à White Label e seus perfis atuais.</p></div></div>
      {data.members.length ? <div className="console-compact-list">{data.members.map((member) => <div className="console-compact-row" key={`${member.userId}:${member.role}`}><div><strong>{roleLabel(member.role)}</strong><small>Identificador técnico: {member.userId}</small></div><span>Desde {date(member.createdAt)}</span></div>)}</div> : <div className="control-empty"><strong>Nenhum acesso encontrado</strong><p>Não há membros cadastrados para esta White Label.</p></div>}
    </section>
    <section className="control-editorial-section" id="audit">
      <div className="control-editorial-section__header"><div><h2>Atividade recente</h2><p>Registro somente leitura das ações administrativas.</p></div></div>
      {data.audits.length ? <div className="console-compact-list">{data.audits.slice(0, 10).map((item) => <div className="console-compact-row" key={item.id}><div><strong>{item.action}</strong><small>{item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ""}</small></div><span>{dateTime(item.createdAt)}</span></div>)}</div> : <div className="control-empty"><strong>Sem atividade registrada</strong><p>As ações auditáveis aparecerão aqui quando existirem.</p></div>}
    </section>
  </div>;
}

export function ControlDashboard({ data, billing, children }: Readonly<{ data: ControlData; billing: TenantBillingWorkspace; children: ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#overview");

  useEffect(() => {
    function syncHash(): void { setActiveHref(initialControlHash()); }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => { window.removeEventListener("hashchange", syncHash); };
  }, []);

  return <div className="control-shell console-shell">
    <a className="console-skip-link" href="#control-content">Pular para o conteúdo</a>
    <ControlSidebar data={data} open={mobileOpen} activeHref={activeHref} onClose={() => { setMobileOpen(false); }} onNavigate={setActiveHref} />
    <main className="control-main console-shell__content">
      <div className="control-mobile-bar"><button type="button" className="control-mobile-bar__menu" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu"><DashboardIcon name="menu" /></button><div><strong>{data.tenant.name}</strong><span>Painel da White Label</span></div></div>
      <div className="control-content console-container" id="control-content" tabIndex={-1}><Overview data={data} billing={billing} />{children}<BrandingSnapshot data={data} /><AccessAndAudit data={data} /></div>
    </main>
  </div>;
}
