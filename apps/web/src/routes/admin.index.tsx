import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";

export const Route = createFileRoute("/admin/")({
  loader: () => getMerchantOperationsDashboard(),
  component: AdminDashboard,
});

function Stat(props: Readonly<{ label: string; value: string | number }>): React.JSX.Element {
  return (
    <div className="k-card">
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
        <Stat label="Pedidos hoje" value={metrics.ordersToday} />
        <Stat label="Pedidos pendentes" value={metrics.pendingOrders} />
        <Stat label="Faturamento — 30 dias" value={formatMoney(metrics.revenuePeriodCents)} />
        <Stat label="Ticket médio — 30 dias" value={formatMoney(metrics.averageTicketCents)} />
        <Stat label="Produtos ativos" value={metrics.activeProducts} />
        <Stat label="Estoque baixo" value={metrics.lowStockProducts} />
        <Stat label="Clientes" value={metrics.customers} />
        <Stat label="Plano" value={data.plan?.name ?? data.plan?.slug ?? "Sem plano identificado"} />
        <Stat label="Conta" value={accountStatus(data.store.tenantStatus, data.store.trialEndsAt)} />
        <Stat label="Layout do catálogo" value={data.layout === "modern" ? "Modern" : "Classic"} />
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
