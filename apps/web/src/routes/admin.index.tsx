import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { Section } from "../admin/ui/Section.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OnboardingChecklist } from "../features/store-admin/onboarding-checklist.tsx";
import { getMerchantOnboarding } from "../lib/server/onboarding.functions.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";
import { statusLabel } from "../lib/ui-labels.ts";
import styles from "./admin.index.module.css";

type Operations = Awaited<ReturnType<typeof getMerchantOperationsDashboard>>;
type Metrics = Operations["metrics"];
type RecentOrders = Operations["activity"]["recentOrders"];

export const Route = createFileRoute("/admin/")({
  loader: async () => {
    const [operations, onboarding] = await Promise.allSettled([
      getMerchantOperationsDashboard(),
      getMerchantOnboarding(),
    ]);
    return {
      operations: operations.status === "fulfilled" ? operations.value : null,
      onboarding: onboarding.status === "fulfilled" ? onboarding.value : null,
    };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: Dashboard,
});

function plural(value: number, singular: string, pluralForm: string): string {
  return `${String(value)} ${value === 1 ? singular : pluralForm}`;
}

function MetricsStrip({ metrics }: Readonly<{ metrics: Metrics }>): React.JSX.Element {
  const items = [
    ["Pedidos hoje", String(metrics.ordersToday), "hoje"],
    ["Para atender", String(metrics.pendingOrders), "aguardando ação"],
    ["Vendas", formatMoney(metrics.revenuePeriodCents), "últimos 30 dias"],
    ["Produtos publicados", String(metrics.activeProducts), "no catálogo"],
  ];
  return (
    <section className={styles.metrics} aria-label="Números do período">
      {items.map(([label, value, hint]) => (
        <div className={styles.metric} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{hint}</small>
        </div>
      ))}
    </section>
  );
}

function Attention({ metrics }: Readonly<{ metrics: Metrics }>): React.JSX.Element {
  const hasPending = metrics.pendingOrders > 0;
  const hasLowStock = metrics.lowStockProducts > 0;
  const hasCatalog = metrics.activeProducts > 0;
  if (!hasPending && !hasLowStock && hasCatalog) {
    return <p className={styles.clearState}>Nada esperando por você agora.</p>;
  }
  return (
    <div className={styles.attentionList}>
      {hasPending ? (
        <Link className={styles.attentionRow} to="/admin/orders">
          <span className={styles.statusDot} />
          <span>
            <strong>{plural(metrics.pendingOrders, "pedido esperando resposta", "pedidos esperando resposta")}</strong>
            <small>Abra os pedidos para continuar o atendimento.</small>
          </span>
          <b>Abrir pedidos</b>
        </Link>
      ) : null}
      {hasLowStock ? (
        <Link className={styles.attentionRow} to="/admin/inventory">
          <span className={`${styles.statusDot} ${styles.warning}`} />
          <span>
            <strong>{plural(metrics.lowStockProducts, "produto com estoque baixo", "produtos com estoque baixo")}</strong>
            <small>Revise as quantidades antes que acabem.</small>
          </span>
          <b>Repor estoque</b>
        </Link>
      ) : null}
      {!hasCatalog ? (
        <Link className={styles.attentionRow} to="/admin/products/new">
          <span className={`${styles.statusDot} ${styles.warning}`} />
          <span>
            <strong>Seu catálogo ainda está vazio</strong>
            <small>Adicione o primeiro produto para começar.</small>
          </span>
          <b>Adicionar produto</b>
        </Link>
      ) : null}
    </div>
  );
}

function RecentOrdersList({ orders }: Readonly<{ orders: RecentOrders }>): React.JSX.Element {
  if (!orders.length) {
    return <EmptyState title="Ainda não há pedidos" description="Quando alguém comprar, aparece aqui." />;
  }
  return (
    <div className={styles.orders}>
      {orders.slice(0, 5).map((order) => (
        <Link className={styles.orderRow} key={order.id} to="/admin/orders/$id" params={{ id: order.id }}>
          <span>
            <strong>#{String(order.orderNumber).padStart(5, "0")} · {order.customerName ?? "Cliente"}</strong>
            <small>{statusLabel(order.status)} · {new Date(order.createdAt).toLocaleString("pt-BR")}</small>
          </span>
          <b>{formatMoney(order.totalCents)}</b>
        </Link>
      ))}
      <Link className={styles.allOrders} to="/admin/orders">Ver todos os pedidos</Link>
    </div>
  );
}

function Dashboard(): React.JSX.Element {
  const { operations, onboarding } = Route.useLoaderData();
  if (!operations) {
    return (
      <div className={styles.page}>
        <PageHeader title="Início" description="Não consegui carregar o resumo da operação." />
        {onboarding ? <OnboardingChecklist data={onboarding} /> : null}
        <EmptyState title="Resumo indisponível" description="Atualize a página para tentar de novo." />
      </div>
    );
  }
  const metrics = operations.metrics;
  const summary = metrics.pendingOrders || metrics.lowStockProducts
    ? `Você tem ${plural(metrics.pendingOrders, "pedido esperando resposta", "pedidos esperando resposta")} e ${plural(metrics.lowStockProducts, "produto com estoque baixo", "produtos com estoque baixo")}.`
    : "Nada esperando por você agora.";
  return (
    <div className={styles.page}>
      <PageHeader
        title={`Boa tarde, ${operations.store.name}.`}
        description={summary}
        action={<Link className={styles.primaryAction} to="/admin/products/new">Adicionar produto</Link>}
      />
      <Section title="Para resolver agora"><Attention metrics={metrics} /></Section>
      <MetricsStrip metrics={metrics} />
      <div className={styles.columns}>
        <Section title="Últimos pedidos">
          <RecentOrdersList orders={operations.activity.recentOrders} />
        </Section>
        {onboarding && onboarding.progress.percent < 100 ? (
          <Section title="Primeiros passos"><OnboardingChecklist data={onboarding} /></Section>
        ) : null}
      </div>
    </div>
  );
}
