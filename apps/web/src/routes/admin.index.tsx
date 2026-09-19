import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardIcon, type DashboardIconName } from "../components/dashboard/DashboardIcon.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";

export const Route = createFileRoute("/admin/")({
  loader: () => getMerchantOperationsDashboard(),
  component: AdminDashboard,
});

function accountStatus(status: "trial" | "active" | "suspended", trialEndsAt: string | null): string {
  if (status === "trial") return trialEndsAt ? "Trial até " + new Date(trialEndsAt).toLocaleDateString("pt-BR") : "Trial";
  return status === "active" ? "Ativa" : "Suspensa";
}

function relative(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function DashboardBar(props: Readonly<{ label: string; value: number; max: number; detail: string }>): React.JSX.Element {
  const progress = relative(props.value, props.max);
  return <div className="k-dashboard-bar"><div className="k-dashboard-bar__head"><strong>{props.label}</strong><span>{props.detail}</span></div><div className="k-dashboard-bar__track" aria-hidden="true"><span style={{ width: `${String(progress)}%` }} /></div></div>;
}

function QuickLink(props: Readonly<{ to: "/admin/products" | "/admin/orders" | "/admin/customers" | "/admin/inventory"; label: string; icon: DashboardIconName }>): React.JSX.Element {
  return <Link className="k-quick-link" to={props.to}><DashboardIcon name={props.icon} /><strong>{props.label}</strong></Link>;
}

function AttentionRow(props: Readonly<{ label: string; value: string | number; to: "/admin/orders" | "/admin/inventory" | "/admin/products" }>): React.JSX.Element {
  return <Link className="k-store-link" to={props.to}><div><strong>{props.label}</strong><span>Abra a área para revisar e agir.</span></div><b>{props.value}</b></Link>;
}

function AdminDashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const metrics = data.metrics;
  const maxCount = Math.max(metrics.ordersToday, metrics.pendingOrders, metrics.activeProducts, metrics.customers, 1);
  return <div className="k-page k-dashboard">
    <PageHead title={data.store.name} description="O que exige atenção hoje e o estado real da operação da loja." action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>} />

    <div className="k-dashboard-grid">
      <section className="k-card k-dashboard-panel">
        <div className="k-dashboard-panel__head"><div><h2>Atenção operacional</h2><p>Priorize pendências antes de acompanhar desempenho.</p></div></div>
        <div className="k-store-links">
          <AttentionRow label="Pedidos pendentes" value={metrics.pendingOrders} to="/admin/orders" />
          <AttentionRow label="Produtos com estoque baixo" value={metrics.lowStockProducts} to="/admin/inventory" />
          <AttentionRow label="Produtos ativos" value={metrics.activeProducts} to="/admin/products" />
        </div>
      </section>

      <aside className="k-card k-dashboard-panel k-account-panel">
        <div className="k-dashboard-panel__head"><div><h2>Conta e loja</h2><p>Status comercial e configuração atual.</p></div></div>
        <div className="k-account-card"><span>Conta</span><strong>{accountStatus(data.store.tenantStatus, data.store.trialEndsAt)}</strong></div>
        <div className="k-account-card"><span>Plano</span><strong>{data.plan?.name ?? data.plan?.slug ?? "Não identificado"}</strong></div>
        <div className="k-account-card"><span>Catálogo</span><strong>{data.layout === "modern" ? "Modern" : "Classic"}</strong></div>
      </aside>
    </div>

    <section className="k-card k-dashboard-panel">
      <div className="k-dashboard-panel__head"><div><h2>Volume atual</h2><p>Indicadores operacionais reais, sem estimativas.</p></div><span className="k-account-badge">30 dias quando indicado</span></div>
      <div className="k-dashboard-bars">
        <DashboardBar label="Pedidos hoje" value={metrics.ordersToday} max={maxCount} detail={String(metrics.ordersToday)} />
        <DashboardBar label="Pedidos pendentes" value={metrics.pendingOrders} max={maxCount} detail={String(metrics.pendingOrders)} />
        <DashboardBar label="Clientes" value={metrics.customers} max={maxCount} detail={String(metrics.customers)} />
        <DashboardBar label="Produtos ativos" value={metrics.activeProducts} max={maxCount} detail={String(metrics.activeProducts)} />
      </div>
      <div className="k-row" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #ecece7" }}><div><span className="k-muted">Faturamento · 30 dias</span><strong style={{ display: "block", marginTop: 3 }}>{formatMoney(metrics.revenuePeriodCents)}</strong></div><div><span className="k-muted">Ticket médio · 30 dias</span><strong style={{ display: "block", marginTop: 3 }}>{formatMoney(metrics.averageTicketCents)}</strong></div></div>
    </section>

    <section className="k-dashboard-shortcuts"><div className="k-dashboard-panel__head"><div><h2>Acesso rápido</h2><p>Rotinas mais usadas.</p></div></div><div className="k-quick-grid"><QuickLink to="/admin/products" icon="products" label="Produtos" /><QuickLink to="/admin/orders" icon="orders" label="Pedidos" /><QuickLink to="/admin/customers" icon="customers" label="Clientes" /><QuickLink to="/admin/inventory" icon="inventory" label="Estoque" /></div></section>
  </div>;
}
