import type { ReactNode } from "react";
import { useState } from "react";
import {
  DashboardIcon,
  type DashboardIconName,
} from "../../components/dashboard/DashboardIcon.tsx";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";

type ControlData = TenantControlDashboardData;

type NavigationItem = Readonly<{
  href: string;
  label: string;
  icon: DashboardIconName;
}>;

const navigation: readonly NavigationItem[] = [
  { href: "#overview", label: "Visão geral", icon: "home" },
  { href: "#tenant-billing", label: "Faturamento", icon: "billing" },
  { href: "#merchant-management", label: "Lojistas", icon: "store" },
  { href: "#plan-management", label: "Planos", icon: "subscriptions" },
  { href: "#branding", label: "Branding", icon: "palette" },
  { href: "#domain-management", label: "Domínios", icon: "domains" },
  { href: "#gateway-management", label: "Gateways", icon: "integrations" },
];

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function date(value: string): string {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function ControlSidebar(props: Readonly<{ data: ControlData; open: boolean; onClose: () => void }>) {
  return (
    <>
      <button type="button" className={props.open ? "control-overlay is-open" : "control-overlay"} onClick={props.onClose} aria-label="Fechar menu" />
      <aside className={props.open ? "control-sidebar is-open" : "control-sidebar"} aria-label="Navegação da White Label">
        <div className="control-brand">
          <span className="control-brand__mark" aria-hidden="true">K</span>
          <div><strong>{props.data.tenant.name}</strong><small>Controle da White Label</small></div>
        </div>
        <nav className="control-nav" aria-label="Áreas do painel">
          <div className="console-nav-group">
            <span className="console-nav-group__label">Gestão</span>
            {navigation.map((item) => (
              <a href={item.href} key={item.href} onClick={props.onClose}><DashboardIcon name={item.icon} /><span>{item.label}</span></a>
            ))}
          </div>
        </nav>
        <div className="control-sidebar__footer console-sidebar-context"><span>White Label</span><strong>{props.data.tenant.status}</strong></div>
      </aside>
    </>
  );
}

function SummaryItem(props: Readonly<{ label: string; value: ReactNode; detail: string }>) {
  return <div className="control-summary-item"><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></div>;
}

function Overview({ data }: Readonly<{ data: ControlData }>) {
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const activeSubscriptions = data.subscriptions.filter((item) => item.status === "active").length;
  const trialSubscriptions = data.subscriptions.filter((item) => item.status === "trialing").length;
  const pastDueSubscriptions = data.subscriptions.filter((item) => item.status === "past_due").length;
  const paidPayments = data.payments.filter((item) => item.status === "paid");
  const paid = paidPayments.reduce((sum, item) => sum + item.amountCents, 0);
  const pendingPayments = data.payments.filter((item) => item.status === "pending").length;
  const pendingDomains = data.domains.filter((item) => item.status !== "active").length;
  const suspendedStores = data.stores.filter((item) => item.status === "suspended").length;

  return (
    <section className="control-section control-overview" id="overview">
      <div className="control-page-header">
        <div><span className="console-page-kicker">White Label</span><h1>Visão geral</h1><p>Operação, assinaturas e faturamento da sua plataforma em uma leitura direta.</p></div>
        <span className="console-context-note">{data.tenant.slug}</span>
      </div>
      <div className="control-summary-surface" aria-label="Resumo operacional">
        <SummaryItem label="Lojas" value={data.stores.length} detail={`${String(activeStores)} ativas`} />
        <SummaryItem label="Assinaturas" value={data.subscriptions.length} detail={`${String(activeSubscriptions)} ativas · ${String(trialSubscriptions)} trials`} />
        <SummaryItem label="Recebido" value={money(paid)} detail={`${String(paidPayments.length)} pagamentos confirmados`} />
        <SummaryItem label="Domínios" value={data.domains.length} detail={`${String(data.domains.length - pendingDomains)} ativos`} />
      </div>
      <div className="control-dashboard-layout">
        <section className="console-panel control-operations-panel">
          <div className="console-panel__header"><div><h2>Situação da operação</h2><p>Itens que merecem acompanhamento agora.</p></div></div>
          <div className="console-fact-list">
            <div className="console-fact-row"><div><strong>Assinaturas em atraso</strong><small>Status past_due</small></div><b>{pastDueSubscriptions}</b></div>
            <div className="console-fact-row"><div><strong>Pagamentos pendentes</strong><small>Aguardando confirmação</small></div><b>{pendingPayments}</b></div>
            <div className="console-fact-row"><div><strong>Lojas suspensas</strong><small>Fora do status ativo</small></div><b>{suspendedStores}</b></div>
            <div className="console-fact-row"><div><strong>Domínios pendentes</strong><small>Ainda não ativos</small></div><b>{pendingDomains}</b></div>
          </div>
        </section>
        <section className="console-panel control-recent-panel">
          <div className="console-panel__header"><div><h2>Lojas recentes</h2><p>Uma leitura rápida da base atual.</p></div></div>
          {data.stores.length ? <div className="console-compact-list">{data.stores.slice(0, 5).map((store) => <div className="console-compact-row" key={store.id}><div><strong>{store.name}</strong><small>{store.slug} · {String(store.memberCount)} membros</small></div><span>{store.status}</span></div>)}</div> : <div className="control-empty"><strong>Nenhuma loja ainda</strong><p>Cadastre o primeiro lojista para começar a operação.</p></div>}
        </section>
      </div>
      <section className="console-panel control-finance-snapshot">
        <div className="console-panel__header"><div><h2>Pagamentos recentes</h2><p>Movimentações registradas para esta White Label.</p></div><a href="#tenant-billing">Ver faturamento</a></div>
        {data.payments.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Data</th><th>Nível</th><th>Status</th><th>Valor</th></tr></thead><tbody>{data.payments.slice(0, 6).map((item) => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.level}</td><td><span className="control-badge">{item.status}</span></td><td className="console-money">{money(item.amountCents)}</td></tr>)}</tbody></table></div> : <div className="control-empty"><strong>Sem pagamentos registrados</strong><p>As movimentações financeiras aparecerão aqui quando existirem.</p></div>}
      </section>
    </section>
  );
}

function BrandingSnapshot({ data }: Readonly<{ data: ControlData }>) {
  const hasSettings = data.tenant.settings.trim().length > 0;
  return (
    <section className="control-section" id="branding">
      <div className="control-section__head"><div><span className="control-kicker">Identidade</span><h2>Branding da White Label</h2><p>Referência visual atualmente persistida para esta plataforma.</p></div></div>
      <div className="control-grid control-grid--two">
        <section className="console-panel control-branding-preview">
          <div className="console-panel__header"><div><h2>Marca</h2><p>Logo configurada no tenant.</p></div></div>
          <div className="console-brand-preview">{data.tenant.logoUrl ? <img className="control-logo" src={data.tenant.logoUrl} alt={`Logo de ${data.tenant.name}`} /> : <div className="control-empty"><strong>Logo não configurada</strong><p>A identidade aparecerá aqui quando houver uma URL de logo persistida.</p></div>}</div>
        </section>
        <section className="console-panel control-branding-color">
          <div className="console-panel__header"><div><h2>Identidade visual</h2><p>Cor principal e configuração estruturada.</p></div></div>
          <div className="console-brand-color"><span style={{ background: data.tenant.primaryColor ?? "#315efb" }} aria-hidden="true" /><div><strong>{data.tenant.primaryColor ?? "Não configurada"}</strong><small>{hasSettings ? "Configuração persistida" : "Sem configurações adicionais"}</small></div></div>
          <details className="console-disclosure"><summary>Ver configuração estruturada</summary><pre className="control-json">{hasSettings ? data.tenant.settings : "{}"}</pre></details>
        </section>
      </div>
    </section>
  );
}

export function ControlDashboard({ data, children }: Readonly<{ data: ControlData; children: ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="control-shell console-shell">
      <a className="console-skip-link" href="#control-content">Pular para o conteúdo</a>
      <ControlSidebar data={data} open={mobileOpen} onClose={() => { setMobileOpen(false); }} />
      <main className="control-main console-shell__content">
        <header className="control-header console-header">
          <button type="button" className="control-menu" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu"><DashboardIcon name="menu" /></button>
          <div className="console-header__context"><span>White Label</span><strong>{data.tenant.name}</strong></div>
          <div className="control-header__status"><span className="control-header__avatar" aria-hidden="true">{data.tenant.name.slice(0, 1).toUpperCase()}</span><div><small>Plataforma</small><strong>{data.tenant.slug}</strong></div></div>
        </header>
        <div className="control-content console-container" id="control-content" tabIndex={-1}>
          <Overview data={data} />
          {children}
          <BrandingSnapshot data={data} />
        </div>
      </main>
    </div>
  );
}
