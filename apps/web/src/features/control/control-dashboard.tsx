import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import {
  DashboardIcon,
  type DashboardIconName,
} from "../../components/dashboard/DashboardIcon.tsx";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";

type ControlData = TenantControlDashboardData;

const navigation: ReadonlyArray<{ href: string; label: string; icon: DashboardIconName }> = [
  { href: "#overview", label: "Visão geral", icon: "home" },
  { href: "#stores", label: "Lojistas e lojas", icon: "store" },
  { href: "#plans", label: "Planos e assinaturas", icon: "subscriptions" },
  { href: "#billing", label: "Faturamento", icon: "billing" },
  { href: "#branding", label: "Branding", icon: "palette" },
  { href: "#domains", label: "Domínios", icon: "domains" },
  { href: "#settings", label: "Configurações", icon: "settings" },
  { href: "#support", label: "Suporte", icon: "support" },
  { href: "#integrations", label: "Integrações", icon: "integrations" },
];

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function date(value: string): string {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function Metric(props: Readonly<{ label: string; value: ReactNode; detail: string; icon: DashboardIconName }>) {
  return (
    <article className="control-card control-metric">
      <div><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></div>
      <span className="control-metric__icon" aria-hidden="true"><DashboardIcon name={props.icon} /></span>
    </article>
  );
}

function Section(props: Readonly<{ id: string; title: string; description: string; children: ReactNode }>) {
  return (
    <section className="control-section" id={props.id}>
      <div className="control-section__head"><h2>{props.title}</h2><p>{props.description}</p></div>
      {props.children}
    </section>
  );
}

function ControlSidebar(props: Readonly<{ data: ControlData; open: boolean; onClose: () => void }>) {
  return (
    <>
      <button type="button" className={props.open ? "control-overlay is-open" : "control-overlay"} onClick={props.onClose} aria-label="Fechar menu" />
      <aside className={props.open ? "control-sidebar is-open" : "control-sidebar"}>
        <div className="control-brand"><span className="control-brand__mark">K</span><div><strong>{props.data.tenant.name}</strong><small>White Label Control</small></div></div>
        <nav className="control-nav" aria-label="White Label Control">
          {navigation.map((item) => <a href={item.href} key={item.href} onClick={props.onClose}><DashboardIcon name={item.icon} /><span>{item.label}</span></a>)}
        </nav>
        <div className="control-sidebar__footer"><span className="control-status-dot" /><div><span>Status</span><strong>{props.data.tenant.status}</strong></div></div>
      </aside>
    </>
  );
}

function OverviewBar(props: Readonly<{ label: string; value: number; total: number; detail: string }>) {
  const value = percent(props.value, props.total);
  return (
    <div className="control-bar-row">
      <div><strong>{props.label}</strong><small>{props.detail}</small></div>
      <div className="control-bar-track"><span style={{ width: `${String(value)}%` }} /></div>
      <strong>{value}%</strong>
    </div>
  );
}

function Overview({ data }: Readonly<{ data: ControlData }>) {
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const activeDomains = data.domains.filter((item) => item.status === "active").length;
  const activeSubscriptions = data.subscriptions.filter((item) => item.status === "active").length;
  const paidPayments = data.payments.filter((item) => item.status === "paid");
  const paid = paidPayments.reduce((sum, item) => sum + item.amountCents, 0);
  const storeCoverage = percent(activeStores, data.stores.length);
  const ringStyle = { "--control-progress": `${String(storeCoverage)}%` } as CSSProperties;
  return (
    <Section id="overview" title="Visão geral" description="Acompanhe lojas, domínios, assinaturas e faturamento da sua White Label.">
      <div className="control-metrics">
        <Metric icon="store" label="Lojas" value={data.stores.length} detail={`${String(activeStores)} ativas`} />
        <Metric icon="domains" label="Domínios" value={data.domains.length} detail={`${String(activeDomains)} ativos`} />
        <Metric icon="subscriptions" label="Assinaturas" value={data.subscriptions.length} detail={`${String(activeSubscriptions)} ativas`} />
        <Metric icon="revenue" label="Recebido" value={money(paid)} detail={`${String(paidPayments.length)} pagamentos confirmados`} />
      </div>
      <div className="control-overview-grid">
        <div className="control-card control-analytics-card">
          <div className="control-analytics-head">
            <div><h3>Panorama operacional</h3><p>Proporção real de recursos ativos nesta plataforma.</p></div>
            <span className="control-badge">Atual</span>
          </div>
          <div className="control-bars">
            <OverviewBar label="Lojas ativas" value={activeStores} total={Math.max(data.stores.length, 1)} detail={`${String(activeStores)} de ${String(data.stores.length)}`} />
            <OverviewBar label="Domínios ativos" value={activeDomains} total={Math.max(data.domains.length, 1)} detail={`${String(activeDomains)} de ${String(data.domains.length)}`} />
            <OverviewBar label="Assinaturas ativas" value={activeSubscriptions} total={Math.max(data.subscriptions.length, 1)} detail={`${String(activeSubscriptions)} de ${String(data.subscriptions.length)}`} />
            <OverviewBar label="Pagamentos confirmados" value={paidPayments.length} total={Math.max(data.payments.length, 1)} detail={`${String(paidPayments.length)} de ${String(data.payments.length)}`} />
          </div>
        </div>
        <div className="control-card control-health-card">
          <div className="control-analytics-head"><div><h3>Saúde das lojas</h3><p>Percentual de lojas com status ativo.</p></div></div>
          <div className="control-health-summary">
            <div className="control-health-ring" style={ringStyle}><div><strong>{storeCoverage}%</strong><span>ativas</span></div></div>
            <div className="control-health-meta">
              <div><span>Lojas</span><strong>{data.stores.length}</strong></div>
              <div><span>Domínios ativos</span><strong>{activeDomains}</strong></div>
              <div><span>Assinaturas</span><strong>{activeSubscriptions}</strong></div>
              <div><span>Recebido</span><strong>{money(paid)}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Stores({ data }: Readonly<{ data: ControlData }>) {
  return (
    <Section id="stores" title="Lojistas e lojas" description="Lojas vinculadas a esta White Label e suas memberships.">
      {data.stores.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Loja</th><th>Status</th><th>Membros</th><th>Criada em</th></tr></thead><tbody>{data.stores.map((store) => <tr key={store.id}><td><strong>{store.name}</strong><small>{store.slug}</small></td><td><span className="control-badge">{store.status}</span></td><td>{store.memberCount}</td><td>{date(store.createdAt)}</td></tr>)}</tbody></table></div> : <div className="control-empty">Nenhuma loja vinculada a esta White Label.</div>}
    </Section>
  );
}

function PlansBilling({ data }: Readonly<{ data: ControlData }>) {
  return (
    <>
      <Section id="plans" title="Planos e assinaturas" description="Planos disponíveis e assinaturas reais do tenant.">
        <div className="control-grid control-grid--two">
          <div className="control-card"><h3>Assinaturas</h3>{data.subscriptions.length ? data.subscriptions.map((item) => <div className="control-row" key={item.id}><div><strong>{item.planName ?? "Sem plano"}</strong><small>{item.level}</small></div><span className="control-badge">{item.status}</span></div>) : <div className="control-empty">Nenhuma assinatura registrada.</div>}</div>
          <div className="control-card"><h3>Planos disponíveis</h3>{data.plans.length ? data.plans.map((plan) => <div className="control-row" key={plan.id}><div><strong>{plan.name}</strong><small>{plan.slug}</small></div><span>{money(plan.priceCents)}</span></div>) : <div className="control-empty">Nenhum plano configurado.</div>}</div>
        </div>
      </Section>
      <Section id="billing" title="Faturamento" description="Pagamentos registrados para este tenant.">
        {data.payments.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Data</th><th>Nível</th><th>Status</th><th>Valor</th></tr></thead><tbody>{data.payments.map((item) => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.level}</td><td><span className="control-badge">{item.status}</span></td><td>{money(item.amountCents)}</td></tr>)}</tbody></table></div> : <div className="control-empty">Nenhum pagamento registrado.</div>}
      </Section>
    </>
  );
}

function Configuration({ data }: Readonly<{ data: ControlData }>) {
  return (
    <>
      <Section id="branding" title="Branding" description="Identidade visual configurada para esta White Label.">
        <div className="control-grid control-grid--two"><div className="control-card"><h3>Logo</h3>{data.tenant.logoUrl ? <img className="control-logo" src={data.tenant.logoUrl} alt="Logo da White Label" /> : <div className="control-empty">Nenhuma logo configurada.</div>}</div><div className="control-card"><h3>Cor principal</h3><div className="control-color"><span style={{ background: data.tenant.primaryColor ?? "#5468ff" }} /><code>{data.tenant.primaryColor ?? "Não configurada"}</code></div></div></div>
      </Section>
      <Section id="domains" title="Domínios" description="A tabela domains é a fonte autoritativa.">
        {data.domains.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Hostname</th><th>Tipo</th><th>Status</th><th>Verificado</th></tr></thead><tbody>{data.domains.map((item) => <tr key={item.id}><td><strong>{item.hostname}</strong></td><td>{item.type}</td><td><span className="control-badge">{item.status}</span></td><td>{item.verifiedAt ? date(item.verifiedAt) : "Pendente"}</td></tr>)}</tbody></table></div> : <div className="control-empty">Nenhum domínio cadastrado para este tenant.</div>}
      </Section>
      <Section id="settings" title="Configurações" description="Configurações estruturadas persistidas no tenant."><div className="control-card"><pre className="control-json">{JSON.stringify(data.tenant.settings, null, 2)}</pre></div></Section>
    </>
  );
}

function SupportIntegrations({ data }: Readonly<{ data: ControlData }>) {
  return (
    <>
      <Section id="support" title="Suporte" description="Não existe fonte de tickets no schema atual."><div className="control-empty">Nenhum módulo de tickets foi persistido ainda; nenhum dado é inventado.</div></Section>
      <Section id="integrations" title="Integrações" description="Contas de gateway vinculadas ao tenant.">{data.gateways.length ? <div className="control-grid control-grid--two">{data.gateways.map((item) => <div className="control-card" key={item.id}><span className="control-kicker">{item.level}</span><h3>{item.label}</h3><p>{item.provider}</p></div>)}</div> : <div className="control-empty">Nenhuma integração de gateway configurada.</div>}</Section>
    </>
  );
}

export function ControlDashboard({ data }: Readonly<{ data: ControlData }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="control-shell control-dashboard-rich">
      <ControlSidebar data={data} open={mobileOpen} onClose={() => { setMobileOpen(false); }} />
      <main className="control-main">
        <header className="control-header">
          <button type="button" className="control-menu" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu"><DashboardIcon name="menu" /></button>
          <div><span>White Label</span><strong>{data.tenant.name}</strong></div>
          <div className="control-header__status"><span className="control-header__avatar">{data.tenant.name.slice(0, 1).toUpperCase()}</span><div><small>Plataforma</small><strong>{data.tenant.slug}</strong></div></div>
        </header>
        <div className="control-content"><Overview data={data} /><Stores data={data} /><PlansBilling data={data} /><Configuration data={data} /><SupportIntegrations data={data} /></div>
      </main>
    </div>
  );
}
