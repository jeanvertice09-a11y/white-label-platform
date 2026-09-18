import type { ReactNode } from "react";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";

type ControlData = TenantControlDashboardData;

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function date(value: string): string { return value ? new Date(value).toLocaleDateString("pt-BR") : "—"; }
function Metric(props: Readonly<{ label: string; value: ReactNode; detail: string }>) {
  return <article className="control-card control-metric"><span>{props.label}</span><strong>{props.value}</strong><small>{props.detail}</small></article>;
}
function Section(props: Readonly<{ id: string; title: string; description: string; children: ReactNode }>) {
  return <section className="control-section" id={props.id}><div className="control-section__head"><div><h2>{props.title}</h2><p>{props.description}</p></div></div>{props.children}</section>;
}

function Overview({ data }: Readonly<{ data: ControlData }>) {
  const activeStores = data.stores.filter((item) => item.status === "active").length;
  const activeDomains = data.domains.filter((item) => item.status === "active").length;
  const activeSubscriptions = data.subscriptions.filter((item) => item.status === "active").length;
  const paid = data.payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amountCents, 0);
  return <Section id="overview" title="Visão geral" description="Resumo real da sua plataforma White Label."><div className="control-metrics">
    <Metric label="Lojas" value={data.stores.length} detail={String(activeStores) + " ativas"} />
    <Metric label="Domínios" value={data.domains.length} detail={String(activeDomains) + " ativos"} />
    <Metric label="Assinaturas" value={data.subscriptions.length} detail={String(activeSubscriptions) + " ativas"} />
    <Metric label="Pagamentos recebidos" value={money(paid)} detail="Registros com status paid" />
  </div></Section>;
}

function Stores({ data }: Readonly<{ data: ControlData }>) {
  return <Section id="stores" title="Lojistas e lojas" description="Lojas vinculadas a este tenant e suas memberships.">{data.stores.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Loja</th><th>Status</th><th>Membros</th><th>Criada em</th></tr></thead><tbody>{data.stores.map((store) => <tr key={store.id}><td><strong>{store.name}</strong><small>{store.slug}</small></td><td>{store.status}</td><td>{store.memberCount}</td><td>{date(store.createdAt)}</td></tr>)}</tbody></table></div> : <div className="control-empty">Nenhuma loja vinculada a esta White Label.</div>}</Section>;
}

function PlansBilling({ data }: Readonly<{ data: ControlData }>) {
  return <><Section id="plans" title="Planos e assinaturas" description="Planos disponíveis e assinaturas reais do tenant."><div className="control-grid control-grid--two"><div className="control-card"><h3>Assinaturas</h3>{data.subscriptions.length ? data.subscriptions.map((item) => <div className="control-row" key={item.id}><div><strong>{item.planName ?? "Sem plano"}</strong><small>{item.level}</small></div><span>{item.status}</span></div>) : <div className="control-empty">Nenhuma assinatura registrada.</div>}</div><div className="control-card"><h3>Planos disponíveis</h3>{data.plans.length ? data.plans.map((plan) => <div className="control-row" key={plan.id}><div><strong>{plan.name}</strong><small>{plan.slug}</small></div><span>{money(plan.priceCents)}</span></div>) : <div className="control-empty">Nenhum plano configurado.</div>}</div></div></Section>
  <Section id="billing" title="Faturamento" description="Pagamentos registrados para este tenant.">{data.payments.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Data</th><th>Nível</th><th>Status</th><th>Valor</th></tr></thead><tbody>{data.payments.map((item) => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.level}</td><td>{item.status}</td><td>{money(item.amountCents)}</td></tr>)}</tbody></table></div> : <div className="control-empty">Nenhum pagamento registrado.</div>}</Section></>;
}

function Configuration({ data }: Readonly<{ data: ControlData }>) {
  return <><Section id="branding" title="Branding" description="Identidade visual configurada para esta White Label."><div className="control-grid control-grid--two"><div className="control-card"><h3>Logo</h3>{data.tenant.logoUrl ? <img className="control-logo" src={data.tenant.logoUrl} alt="Logo da White Label" /> : <div className="control-empty">Nenhuma logo configurada.</div>}</div><div className="control-card"><h3>Cor principal</h3><div className="control-color"><span style={{ background: data.tenant.primaryColor ?? "#111318" }} /><code>{data.tenant.primaryColor ?? "Não configurada"}</code></div></div></div></Section>
  <Section id="domains" title="Domínios" description="A tabela domains é a fonte autoritativa.">{data.domains.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Hostname</th><th>Tipo</th><th>Status</th><th>Verificado</th></tr></thead><tbody>{data.domains.map((item) => <tr key={item.id}><td><strong>{item.hostname}</strong></td><td>{item.type}</td><td>{item.status}</td><td>{item.verifiedAt ? date(item.verifiedAt) : "Pendente"}</td></tr>)}</tbody></table></div> : <div className="control-empty">Nenhum domínio cadastrado para este tenant.</div>}</Section>
  <Section id="settings" title="Configurações" description="Configurações estruturadas persistidas no tenant."><div className="control-card"><pre className="control-json">{JSON.stringify(data.tenant.settings, null, 2)}</pre></div></Section></>;
}

function SupportIntegrations({ data }: Readonly<{ data: ControlData }>) {
  return <><Section id="support" title="Suporte" description="Não existe fonte de tickets no schema atual."><div className="control-empty">Nenhum módulo de tickets foi persistido ainda; nenhum dado é inventado.</div></Section><Section id="integrations" title="Integrações" description="Contas de gateway vinculadas ao tenant.">{data.gateways.length ? <div className="control-grid control-grid--two">{data.gateways.map((item) => <div className="control-card" key={item.id}><span className="control-kicker">{item.level}</span><h3>{item.label}</h3><p>{item.provider}</p></div>)}</div> : <div className="control-empty">Nenhuma integração de gateway configurada.</div>}</Section></>;
}

export function ControlDashboard({ data }: Readonly<{ data: ControlData }>) {
  return <div className="control-shell"><aside className="control-sidebar"><div className="control-brand"><span className="control-brand__mark">K</span><div><strong>{data.tenant.name}</strong><small>White Label Control</small></div></div><nav className="control-nav" aria-label="White Label Control"><a href="#overview">Visão geral</a><a href="#stores">Lojistas e lojas</a><a href="#plans">Planos e assinaturas</a><a href="#billing">Faturamento</a><a href="#branding">Branding</a><a href="#domains">Domínios</a><a href="#settings">Configurações</a><a href="#support">Suporte</a><a href="#integrations">Integrações</a></nav><div className="control-sidebar__footer"><span>Status</span><strong>{data.tenant.status}</strong></div></aside><main className="control-main"><header className="control-header"><div><span>White Label</span><strong>{data.tenant.name}</strong></div><div className="control-header__status">{data.tenant.slug}</div></header><div className="control-content"><Overview data={data} /><Stores data={data} /><PlansBilling data={data} /><Configuration data={data} /><SupportIntegrations data={data} /></div></main></div>;
}
