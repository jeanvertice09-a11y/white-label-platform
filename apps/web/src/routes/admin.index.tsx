import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardIcon, type DashboardIconName } from "../components/dashboard/DashboardIcon.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OnboardingChecklist } from "../features/store-admin/onboarding-checklist.tsx";
import { StorefrontAnalyticsPanel } from "../features/store-admin/storefront-analytics-panel.tsx";
import { getMerchantOnboarding } from "../lib/server/onboarding.functions.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";
import { getCurrentStorefrontAnalytics } from "../lib/server/storefront-analytics.functions.ts";
import { statusLabel } from "../lib/ui-labels.ts";

export const Route = createFileRoute("/admin/")({
  loader: async () => {
    const operations = await getMerchantOperationsDashboard();
    const [analytics, onboarding] = await Promise.all([
      getCurrentStorefrontAnalytics(),
      getMerchantOnboarding(),
    ]);
    return { operations, analytics, onboarding };
  },
  component: AdminDashboard,
});

function accountStatus(
  status: "trial" | "active" | "suspended",
  trialEndsAt: string | null,
): string {
  if (status === "trial") {
    return trialEndsAt
      ? `Trial até ${new Date(trialEndsAt).toLocaleDateString("pt-BR")}`
      : "Trial";
  }
  return status === "active" ? "Ativa" : "Suspensa";
}

function QuickLink(props: Readonly<{
  to: "/admin/products" | "/admin/orders" | "/admin/customers" | "/admin/inventory";
  label: string;
  detail: string;
  icon: DashboardIconName;
}>): React.JSX.Element {
  return (
    <Link className="k-quick-row" to={props.to}>
      <span className="k-quick-row__icon"><DashboardIcon name={props.icon} /></span>
      <span><strong>{props.label}</strong><small>{props.detail}</small></span>
      <b aria-hidden="true">→</b>
    </Link>
  );
}

function DashboardStrip(props: Readonly<{
  ordersToday: number;
  pendingOrders: number;
  revenuePeriodCents: number;
  averageTicketCents: number;
}>): React.JSX.Element {
  return (
    <section className="k-dashboard-strip" aria-label="Indicadores principais">
      <div><span>Pedidos hoje</span><strong>{props.ordersToday}</strong></div>
      <div><span>Pendentes</span><strong>{props.pendingOrders}</strong></div>
      <div><span>Faturamento · 30 dias</span><strong>{formatMoney(props.revenuePeriodCents)}</strong></div>
      <div><span>Ticket médio · 30 dias</span><strong>{formatMoney(props.averageTicketCents)}</strong></div>
    </section>
  );
}

function AttentionSection(props: Readonly<{
  pendingOrders: number;
  lowStockProducts: number;
  activeProducts: number;
}>): React.JSX.Element {
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">Prioridades</span>
          <h2>O que precisa da sua atenção</h2>
          <p>Pendências importantes para manter sua loja funcionando bem.</p>
        </div>
      </header>
      <div className="k-attention-list">
        <Link to="/admin/orders">
          <span><strong>Pedidos pendentes</strong><small>Revise confirmação e andamento.</small></span>
          <b>{props.pendingOrders}</b>
        </Link>
        <Link to="/admin/inventory">
          <span><strong>Estoque baixo</strong><small>Produtos próximos de ruptura.</small></span>
          <b>{props.lowStockProducts}</b>
        </Link>
        <Link to="/admin/products">
          <span><strong>Produtos ativos</strong><small>Itens atualmente disponíveis no catálogo.</small></span>
          <b>{props.activeProducts}</b>
        </Link>
      </div>
    </section>
  );
}

function QuickLinksSection(): React.JSX.Element {
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div><span className="k-section-kicker">Atalhos</span><h2>Acessos rápidos</h2></div>
      </header>
      <div className="k-quick-list">
        <QuickLink to="/admin/products" icon="products" label="Produtos" detail="Cadastre, edite preços e publique" />
        <QuickLink to="/admin/orders" icon="orders" label="Pedidos" detail="Acompanhe vendas e atualize pedidos" />
        <QuickLink to="/admin/customers" icon="customers" label="Clientes" detail="Veja seus clientes e compras anteriores" />
        <QuickLink to="/admin/inventory" icon="inventory" label="Estoque" detail="Confira quantidades e movimentações" />
      </div>
    </section>
  );
}

function RecentOperations(props: Readonly<{
  activity: Awaited<ReturnType<typeof getMerchantOperationsDashboard>>["activity"];
}>): React.JSX.Element {
  const { recentOrders, taskAlerts, stockAlerts } = props.activity;
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div><span className="k-section-kicker">Tempo real</span><h2>Últimas movimentações</h2><p>Acompanhe o que aconteceu recentemente na sua operação.</p></div>
      </header>
      <div className="k-dashboard-activity">
        <div className="k-card">
          <div className="k-row"><h3>Últimos pedidos</h3><Link className="k-text-action" to="/admin/orders">Ver todos</Link></div>
          {recentOrders.length ? <div className="k-config-list">{recentOrders.map((order) => (
            <Link className="k-config-row" key={order.id} to="/admin/orders/$id" params={{ id: order.id }}>
              <span><strong>#{String(order.orderNumber).padStart(5, "0")} · {order.customerName ?? "Cliente não informado"}</strong><small>{statusLabel(order.status)} · {new Date(order.createdAt).toLocaleString("pt-BR")}</small></span>
              <b>{formatMoney(order.totalCents)}</b>
            </Link>
          ))}</div> : <p className="k-muted">Nenhum pedido registrado.</p>}
        </div>
        <div className="k-card">
          <div className="k-row"><h3>Tarefas em aberto</h3><Link className="k-text-action" to="/admin/tasks">Ver todas</Link></div>
          {taskAlerts.length ? <div className="k-config-list">{taskAlerts.map((task) => (
            <Link className="k-config-row" key={task.id} to="/admin/tasks">
              <span><strong>{task.title}</strong><small>{task.priority === "high" ? "Alta prioridade" : task.priority === "low" ? "Baixa prioridade" : "Prioridade normal"}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString("pt-BR")}` : " · sem prazo"}</small></span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}</div> : <p className="k-muted">Nenhuma tarefa em aberto.</p>}
        </div>
        <div className="k-card">
          <div className="k-row"><h3>Estoque crítico</h3><Link className="k-text-action" to="/admin/inventory">Ver estoque</Link></div>
          {stockAlerts.length ? <div className="k-config-list">{stockAlerts.map((item) => (
            <Link className="k-config-row" key={`${item.productId}:${item.variantId ?? "base"}`} to="/admin/inventory">
              <span><strong>{item.productName}</strong><small>{item.variantName ?? "Produto simples"}</small></span>
              <b>{item.quantity}</b>
            </Link>
          ))}</div> : <p className="k-muted">Nenhum item com estoque baixo.</p>}
        </div>
      </div>
    </section>
  );
}

function AccountContext(props: Readonly<{
  tenantStatus: "trial" | "active" | "suspended";
  trialEndsAt: string | null;
  planName: string | null;
  planSlug: string | null;
  customers: number;
  layout: string;
}>): React.JSX.Element {
  return (
    <aside className="k-dashboard-context">
      <header><span className="k-section-kicker">Contexto</span><h2>Sua conta</h2></header>
      <dl>
        <div><dt>Conta</dt><dd>{accountStatus(props.tenantStatus, props.trialEndsAt)}</dd></div>
        <div><dt>Plano</dt><dd>{props.planName ?? props.planSlug ?? "Não identificado"}</dd></div>
        <div><dt>Clientes</dt><dd>{props.customers}</dd></div>
        <div><dt>Layout</dt><dd>{props.layout === "modern" ? "Modern" : "Classic"}</dd></div>
      </dl>
      <Link className="k-text-action" to="/admin/store">Configurar minha loja →</Link>
    </aside>
  );
}

function AdminDashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const operations = data.operations;
  const metrics = operations.metrics;
  return (
    <div className="k-page k-dashboard">
      <PageHead
        title={operations.store.name}
        description="Acompanhe vendas, pedidos, estoque e tudo o que precisa da sua atenção hoje."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />
      <section className="k-workspace-section" id="primeiros-passos">
        <header className="k-section-head">
          <div><span className="k-section-kicker">Comece por aqui</span><h2>Deixe sua loja pronta para vender</h2><p>Complete os itens abaixo para publicar sua loja e começar a receber pedidos.</p></div>
        </header>
        <OnboardingChecklist data={data.onboarding} />
      </section>
      <DashboardStrip
        ordersToday={metrics.ordersToday}
        pendingOrders={metrics.pendingOrders}
        revenuePeriodCents={metrics.revenuePeriodCents}
        averageTicketCents={metrics.averageTicketCents}
      />
      <StorefrontAnalyticsPanel analytics={data.analytics} />
      <div className="k-dashboard-layout">
        <main className="k-dashboard-primary">
          <AttentionSection pendingOrders={metrics.pendingOrders} lowStockProducts={metrics.lowStockProducts} activeProducts={metrics.activeProducts} />
          <RecentOperations activity={operations.activity} />
          <QuickLinksSection />
        </main>
        <AccountContext
          tenantStatus={operations.store.tenantStatus}
          trialEndsAt={operations.store.trialEndsAt}
          planName={operations.plan?.name ?? null}
          planSlug={operations.plan?.slug ?? null}
          customers={metrics.customers}
          layout={operations.layout}
        />
      </div>
    </div>
  );
}
