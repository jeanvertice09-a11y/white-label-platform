import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardIcon, type DashboardIconName } from "../components/dashboard/DashboardIcon.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";

export const Route = createFileRoute("/admin/")({
  loader: () => getMerchantOperationsDashboard(),
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

function AdminDashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const metrics = data.metrics;
  return (
    <div className="k-page k-dashboard">
      <PageHead
        title={data.store.name}
        description="Visão operacional da loja, com o que merece atenção primeiro."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />

      <section className="k-dashboard-strip" aria-label="Indicadores principais">
        <div><span>Pedidos hoje</span><strong>{metrics.ordersToday}</strong></div>
        <div><span>Pendentes</span><strong>{metrics.pendingOrders}</strong></div>
        <div><span>Faturamento · 30 dias</span><strong>{formatMoney(metrics.revenuePeriodCents)}</strong></div>
        <div><span>Ticket médio · 30 dias</span><strong>{formatMoney(metrics.averageTicketCents)}</strong></div>
      </section>

      <div className="k-dashboard-layout">
        <main className="k-dashboard-primary">
          <section className="k-workspace-section">
            <header className="k-section-head">
              <div>
                <span className="k-section-kicker">Prioridades</span>
                <h2>Atenção operacional</h2>
                <p>Itens que podem exigir ação da equipe agora.</p>
              </div>
            </header>
            <div className="k-attention-list">
              <Link to="/admin/orders">
                <span><strong>Pedidos pendentes</strong><small>Revise confirmação e andamento.</small></span>
                <b>{metrics.pendingOrders}</b>
              </Link>
              <Link to="/admin/inventory">
                <span><strong>Estoque baixo</strong><small>Produtos próximos de ruptura.</small></span>
                <b>{metrics.lowStockProducts}</b>
              </Link>
              <Link to="/admin/products">
                <span><strong>Produtos ativos</strong><small>Itens atualmente disponíveis no catálogo.</small></span>
                <b>{metrics.activeProducts}</b>
              </Link>
            </div>
          </section>

          <section className="k-workspace-section">
            <header className="k-section-head">
              <div>
                <span className="k-section-kicker">Atalhos</span>
                <h2>Rotinas da loja</h2>
              </div>
            </header>
            <div className="k-quick-list">
              <QuickLink to="/admin/products" icon="products" label="Produtos" detail="Catálogo, preço e publicação" />
              <QuickLink to="/admin/orders" icon="orders" label="Pedidos" detail="Venda, status e atendimento" />
              <QuickLink to="/admin/customers" icon="customers" label="Clientes" detail="CRM e histórico de compras" />
              <QuickLink to="/admin/inventory" icon="inventory" label="Estoque" detail="Saldos e movimentações" />
            </div>
          </section>
        </main>

        <aside className="k-dashboard-context">
          <header>
            <span className="k-section-kicker">Contexto</span>
            <h2>Conta e loja</h2>
          </header>
          <dl>
            <div><dt>Conta</dt><dd>{accountStatus(data.store.tenantStatus, data.store.trialEndsAt)}</dd></div>
            <div><dt>Plano</dt><dd>{data.plan?.name ?? data.plan?.slug ?? "Não identificado"}</dd></div>
            <div><dt>Clientes</dt><dd>{metrics.customers}</dd></div>
            <div><dt>Layout</dt><dd>{data.layout === "modern" ? "Modern" : "Classic"}</dd></div>
          </dl>
          <Link className="k-text-action" to="/admin/store">Configurar Minha Loja →</Link>
        </aside>
      </div>
    </div>
  );
}
