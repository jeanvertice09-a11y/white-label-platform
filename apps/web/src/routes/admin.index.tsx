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

function accountStatus(
  status: "trial" | "active" | "suspended",
  trialEndsAt: string | null,
): string {
  if (status === "trial") {
    return trialEndsAt
      ? "Trial até " + new Date(trialEndsAt).toLocaleDateString("pt-BR")
      : "Trial";
  }
  if (status === "active") return "Ativa";
  return "Suspensa";
}

function AdminDashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const metrics = data.metrics;
  return (
    <div className="k-page">
      <PageHead
        title={data.store.name}
        description="Indicadores reais da operação da loja."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />
      <div className="k-grid">
        <Stat icon="orders" label="Pedidos hoje" value={metrics.ordersToday} />
        <Stat icon="activity" label="Pedidos pendentes" value={metrics.pendingOrders} />
        <Stat icon="revenue" label="Faturamento — 30 dias" value={formatMoney(metrics.revenuePeriodCents)} />
        <Stat icon="billing" label="Ticket médio — 30 dias" value={formatMoney(metrics.averageTicketCents)} />
        <Stat icon="products" label="Produtos ativos" value={metrics.activeProducts} />
        <Stat icon="inventory" label="Estoque baixo" value={metrics.lowStockProducts} />
        <Stat icon="customers" label="Clientes" value={metrics.customers} />
        <Stat icon="subscriptions" label="Plano" value={data.plan?.name ?? data.plan?.slug ?? "Sem plano identificado"} />
        <Stat icon="check" label="Conta" value={accountStatus(data.store.tenantStatus, data.store.trialEndsAt)} />
        <Stat icon="palette" label="Layout do catálogo" value={data.layout === "modern" ? "Modern" : "Classic"} />
      </div>
      <div className="k-card">
        <h2>Definição de faturamento</h2>
        <p className="k-muted">
          Últimos 30 dias: soma dos pedidos concluídos cujo pagamento não está
          falho, estornado ou cancelado. Ticket médio = faturamento dividido pelos
          pedidos válidos do mesmo período.
        </p>
        {data.plan ? <p className="k-muted">Status da assinatura: {data.plan.status}.</p> : null}
      </div>
    </div>
  );
}
