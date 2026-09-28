import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardIcon } from "../components/dashboard/DashboardIcon.tsx";
import "../admin/dashboard.css";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OnboardingChecklist } from "../features/store-admin/onboarding-checklist.tsx";
import { getMerchantOnboarding } from "../lib/server/onboarding.functions.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";
import { statusLabel } from "../lib/ui-labels.ts";

export const Route = createFileRoute("/admin/")({
  loader: async () => {
    const [operations, onboarding] = await Promise.allSettled([getMerchantOperationsDashboard(), getMerchantOnboarding()]);
    return { operations: operations.status === "fulfilled" ? operations.value : null, onboarding: onboarding.status === "fulfilled" ? onboarding.value : null };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: Dashboard,
});

type MetricsData = Awaited<ReturnType<typeof getMerchantOperationsDashboard>>["metrics"];
type OrdersData = Awaited<ReturnType<typeof getMerchantOperationsDashboard>>["activity"]["recentOrders"];

function Metric({ label, value, hint, icon, attention = false }: Readonly<{ label: string; value: string | number; hint: string; icon: "orders" | "activity" | "revenue" | "products"; attention?: boolean }>): React.JSX.Element {
  return <article className={attention ? "dashMetric isAttention" : "dashMetric"}><div className="dashMetricTop"><span>{label}</span><span className="dashMetricIcon"><DashboardIcon name={icon} /></span></div><strong>{value}</strong><small>{hint}</small></article>;
}

function Metrics({ metrics }: Readonly<{ metrics: MetricsData }>): React.JSX.Element {
  return <section className="dashMetrics" aria-label="Indicadores da loja">
    <Metric label="Vendas · 30 dias" value={formatMoney(metrics.revenuePeriodCents)} hint="Receita confirmada no período" icon="revenue" />
    <Metric label="Pedidos hoje" value={metrics.ordersToday} hint="Entradas desde o início do dia" icon="orders" />
    <Metric label="Para atender" value={metrics.pendingOrders} hint={metrics.pendingOrders ? "Pedidos aguardando sua ação" : "Nenhuma pendência agora"} icon="activity" attention={metrics.pendingOrders > 0} />
    <Metric label="Produtos ativos" value={metrics.activeProducts} hint="Publicados no catálogo" icon="products" />
  </section>;
}

function Attention({ pending, low, active }: Readonly<{ pending: number; low: number; active: number }>): React.JSX.Element {
  const clear = pending === 0 && low === 0 && active > 0;
  return <section className="dashPanel"><header className="dashPanelHead"><div><h2>Precisa da sua atenção</h2><p>O que vale resolver primeiro hoje.</p></div></header>{clear ? <div className="dashOk"><span className="dashOkMark">✓</span><strong>Tudo em dia</strong><span>Nenhuma pendência importante agora.</span></div> : <div className="dashAttention">
    {pending > 0 ? <Link to="/admin/orders"><span className="dashAttentionMark">{pending}</span><span className="dashAttentionCopy"><strong>Pedidos esperando atendimento</strong><small>Abra os pedidos e continue a venda.</small></span><span className="dashAttentionArrow">→</span></Link> : null}
    {low > 0 ? <Link to="/admin/inventory"><span className="dashAttentionMark">{low}</span><span className="dashAttentionCopy"><strong>Produtos com estoque baixo</strong><small>Revise o saldo antes que acabem.</small></span><span className="dashAttentionArrow">→</span></Link> : null}
    {active === 0 ? <Link to="/admin/products/new"><span className="dashAttentionMark">+</span><span className="dashAttentionCopy"><strong>Seu catálogo está vazio</strong><small>Cadastre o primeiro produto para começar.</small></span><span className="dashAttentionArrow">→</span></Link> : null}
  </div>}</section>;
}

function RecentOrders({ orders }: Readonly<{ orders: OrdersData }>): React.JSX.Element {
  return <section className="dashPanel"><header className="dashPanelHead"><div><h2>Pedidos recentes</h2><p>Últimas movimentações da sua operação.</p></div><Link to="/admin/orders">Ver todos</Link></header>{orders.length ? orders.slice(0, 6).map((order) => <Link className="dashOrder" key={order.id} to="/admin/orders/$id" params={{ id: order.id }}><span className="dashOrderCopy"><strong>#{String(order.orderNumber).padStart(5, "0")} · {order.customerName ?? "Cliente"}</strong><small>{statusLabel(order.status)} · {new Date(order.createdAt).toLocaleString("pt-BR")}</small></span><span className="dashOrderAmount">{formatMoney(order.totalCents)}</span></Link>) : <div className="dashEmpty">Os pedidos aparecerão aqui assim que sua loja começar a vender.</div>}</section>;
}

function Dashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const operations = data.operations;
  if (!operations) return <div className="k-page"><section className="dashHero"><div className="dashHeroCopy"><span className="dashEyebrow">PAINEL DA LOJA</span><h1>Sua operação, em um só lugar.</h1><p>Os dados do resumo estão temporariamente indisponíveis. As ferramentas da loja continuam acessíveis pelo menu.</p></div></section>{data.onboarding ? <div className="dashOnboarding"><OnboardingChecklist data={data.onboarding} /></div> : null}</div>;
  const metrics = operations.metrics;
  return <div className="k-page dash">
    <section className="dashHero"><div className="dashHeroCopy"><span className="dashEyebrow">VISÃO GERAL · {operations.store.name}</span><h1>Veja sua loja funcionando de verdade.</h1><p>Vendas, pedidos e o que precisa da sua atenção — sem ruído, sem planilha e sem procurar em vários menus.</p></div><div className="dashHeroActions"><Link to="/admin/products/new">Novo produto</Link><Link to="/admin/orders">Ver pedidos</Link><Link to="/admin/store/catalog">Configurar loja</Link></div></section>
    <Metrics metrics={metrics} />
    {data.onboarding && data.onboarding.progress.percent < 100 ? <section className="dashOnboarding"><header className="dashOnboardingHead"><span>PRIMEIROS PASSOS</span><h2>Deixe sua loja pronta para vender</h2><p>Complete somente o que ainda falta.</p></header><OnboardingChecklist data={data.onboarding} /></section> : null}
    <div className="dashGrid"><RecentOrders orders={operations.activity.recentOrders} /><Attention pending={metrics.pendingOrders} low={metrics.lowStockProducts} active={metrics.activeProducts} /></div>
  </div>;
}
