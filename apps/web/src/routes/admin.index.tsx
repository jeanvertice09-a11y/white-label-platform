import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardIcon,
  type DashboardIconName,
} from "../components/dashboard/DashboardIcon.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";

export const Route = createFileRoute("/admin/")({
  loader: () => getMerchantOperationsDashboard(),
  component: AdminDashboard,
});

function Stat(props: Readonly<{ label: string; value: string | number; icon: DashboardIconName }>): React.JSX.Element {
  return (
    <div className="k-card k-stat">
      <span className="k-stat__icon" aria-hidden="true"><DashboardIcon name={props.icon} /></span>
      <div className="k-stat__label">{props.label}</div>
      <div className="k-stat__value">{props.value}</div>
    </div>
  );
}

function accountStatus(status: "trial" | "active" | "suspended", trialEndsAt: string | null): string {
  if (status === "trial") {
    return trialEndsAt ? "Trial até " + new Date(trialEndsAt).toLocaleDateString("pt-BR") : "Trial";
  }
  if (status === "active") return "Ativa";
  return "Suspensa";
}

function relative(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function DashboardBar(props: Readonly<{ label: string; value: number; max: number; detail: string }>): React.JSX.Element {
  const progress = relative(props.value, props.max);
  return (
    <div className="k-dashboard-bar">
      <div className="k-dashboard-bar__head"><strong>{props.label}</strong><span>{props.detail}</span></div>
      <div className="k-dashboard-bar__track"><span style={{ width: `${String(progress)}%` }} /></div>
    </div>
  );
}

function QuickLink(props: Readonly<{ to: "/admin/products" | "/admin/orders" | "/admin/customers" | "/admin/inventory"; label: string; icon: DashboardIconName }>): React.JSX.Element {
  return <Link className="k-quick-link" to={props.to}><DashboardIcon name={props.icon} /><strong>{props.label}</strong></Link>;
}

function AdminDashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const metrics = data.metrics;
  const maxCount = Math.max(metrics.ordersToday, metrics.pendingOrders, metrics.activeProducts, metrics.customers, 1);
  return (
    <div className="k-page k-dashboard">
      <PageHead
        title={data.store.name}
        description="Resumo da operação da sua loja, com indicadores reais e atalhos para as rotinas do dia."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />

      <div className="k-grid k-dashboard__stats">
        <Stat icon="revenue" label="Faturamento · 30 dias" value={formatMoney(metrics.revenuePeriodCents)} />
        <Stat icon="orders" label="Pedidos hoje" value={metrics.ordersToday} />
        <Stat icon="billing" label="Ticket médio · 30 dias" value={formatMoney(metrics.averageTicketCents)} />
        <Stat icon="customers" label="Clientes" value={metrics.customers} />
      </div>

      <div className="k-dashboard-grid">
        <section className="k-card k-dashboard-panel">
          <div className="k-dashboard-panel__head">
            <div><h2>Volume operacional</h2><p>Comparativo dos principais volumes atuais da loja.</p></div>
            <span className="k-account-badge">Atual</span>
          </div>
          <div className="k-dashboard-bars">
            <DashboardBar label="Pedidos hoje" value={metrics.ordersToday} max={maxCount} detail={String(metrics.ordersToday)} />
            <DashboardBar label="Pedidos pendentes" value={metrics.pendingOrders} max={maxCount} detail={String(metrics.pendingOrders)} />
            <DashboardBar label="Produtos ativos" value={metrics.activeProducts} max={maxCount} detail={String(metrics.activeProducts)} />
            <DashboardBar label="Clientes" value={metrics.customers} max={maxCount} detail={String(metrics.customers)} />
          </div>
        </section>

        <aside className="k-card k-dashboard-panel k-account-panel">
          <div className="k-dashboard-panel__head"><div><h2>Conta e catálogo</h2><p>Plano, status e configuração atual.</p></div></div>
          <span className="k-account-badge">{data.plan?.status ?? "Sem assinatura"}</span>
          <div className="k-account-card"><span>Plano</span><strong>{data.plan?.name ?? data.plan?.slug ?? "Não identificado"}</strong></div>
          <div className="k-account-card"><span>Conta</span><strong>{accountStatus(data.store.tenantStatus, data.store.trialEndsAt)}</strong></div>
          <div className="k-account-card"><span>Layout do catálogo</span><strong>{data.layout === "modern" ? "Modern" : "Classic"}</strong></div>
          <div className="k-account-card"><span>Alertas de estoque</span><strong>{metrics.lowStockProducts}</strong></div>
        </aside>
      </div>

      <section className="k-dashboard-shortcuts">
        <div className="k-dashboard-panel__head"><div><h2>Acesso rápido</h2><p>Abra as rotinas mais usadas da operação.</p></div></div>
        <div className="k-quick-grid">
          <QuickLink to="/admin/products" icon="products" label="Produtos" />
          <QuickLink to="/admin/orders" icon="orders" label="Pedidos" />
          <QuickLink to="/admin/customers" icon="customers" label="Clientes" />
          <QuickLink to="/admin/inventory" icon="inventory" label="Estoque" />
        </div>
      </section>
    </div>
  );
}
