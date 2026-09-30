import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { OnboardingChecklist } from "../features/store-admin/onboarding-checklist.tsx";
import { getMerchantOnboarding } from "../lib/server/onboarding.functions.ts";
import { getMerchantOperationsDashboard } from "../lib/server/operations-dashboard.functions.ts";
import { statusLabel } from "../lib/ui-labels.ts";
import styles from "../admin/Dashboard.module.css";

export const Route = createFileRoute("/admin/")({
  loader: async () => {
    const startedAt = performance.now();
    const [operations, onboarding] = await Promise.allSettled([
      getMerchantOperationsDashboard(),
      getMerchantOnboarding(),
    ]);
    if (operations.status === "rejected" || onboarding.status === "rejected") {
      console.error("admin.dashboard.partial_failure", {
        durationMs: Math.round(performance.now() - startedAt),
        operationsFailed: operations.status === "rejected",
        onboardingFailed: onboarding.status === "rejected",
      });
    }
    return {
      operations: operations.status === "fulfilled" ? operations.value : null,
      onboarding: onboarding.status === "fulfilled" ? onboarding.value : null,
    };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: Dashboard,
});

function Dashboard() {
  const { operations, onboarding } = Route.useLoaderData();
  const metrics = operations?.metrics;
  const pending = metrics?.pendingOrders ?? 0;
  const lowStock = metrics?.lowStockProducts ?? 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const storeName = operations?.store.name ?? "lojista";

  return <div className={styles.dashboard}>
    <header className={styles.heading}>
      <div>
        <h1>{greeting}, {storeName}.</h1>
        <p>{operations
          ? pending || lowStock
            ? [
              pending ? `${String(pending)} ${pending === 1 ? "pedido esperando" : "pedidos esperando"}` : null,
              lowStock ? `${String(lowStock)} ${lowStock === 1 ? "produto" : "produtos"} com estoque baixo` : null,
            ].filter(Boolean).join(" e ") + "."
            : "Nada esperando por você agora."
          : "Não foi possível carregar o resumo da loja."}</p>
      </div>
      <Link className={styles.primary} to="/admin/products/new">Adicionar produto</Link>
    </header>
    {operations ? <>
      <section className={styles.section} aria-labelledby="attention-title">
        <h2 id="attention-title">Para resolver agora</h2>
        <div className={styles.rows}>
          {pending > 0 ? <Link className={styles.attention} to="/admin/orders">
            <span className={styles.warningDot} aria-hidden="true" />
            <span><strong>{pending === 1 ? "Pedido aguardando" : "Pedidos aguardando"}</strong>
              <small>Confira os pedidos que precisam de atendimento.</small></span>
            <span className={styles.action}>Abrir pedidos</span>
          </Link> : null}
          {lowStock > 0 ? <Link className={styles.attention} to="/admin/products">
            <span className={styles.warningDot} aria-hidden="true" />
            <span><strong>Estoque baixo</strong><small>Revise os produtos antes que acabem.</small></span>
            <span className={styles.action}>Editar produtos</span>
          </Link> : null}
          {!pending && !lowStock ? <p className={styles.quiet}>Nada esperando por você agora.</p> : null}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="numbers-title">
        <h2 id="numbers-title">Números do período</h2>
        <div className={styles.metrics}>
          <Metric label="Pedidos hoje" value={operations.metrics.ordersToday} hint="Entradas de hoje" />
          <Metric label="Para atender" value={pending} hint="Aguardando atendimento" />
          <Metric label="Vendas · 30 dias" value={formatMoney(operations.metrics.revenuePeriodCents)}
            hint="Receita confirmada" />
          <Metric label="Produtos ativos" value={operations.metrics.activeProducts} hint="No catálogo" />
        </div>
      </section>

      <RecentOrders orders={operations.activity.recentOrders} />
      <RecoveryAlerts alerts={operations.activity.recoveryAlerts} />
    </> : <div className={styles.error} role="status">
      <p>Confira a conexão e tente carregar o resumo novamente.</p>
      <button type="button" onClick={() => { window.location.reload(); }}>Tentar de novo</button>
    </div>}

    <FirstSteps onboarding={onboarding} />
  </div>;
}

function FirstSteps({ onboarding }: Readonly<{
  onboarding: Awaited<ReturnType<typeof getMerchantOnboarding>> | null;
}>) {
  if (!onboarding || onboarding.progress.percent >= 100) return null;
  return <section className={styles.section}>
    <h2>Primeiros passos</h2>
    <OnboardingChecklist data={onboarding} />
  </section>;
}

function RecoveryAlerts({ alerts }: Readonly<{
  alerts: Awaited<ReturnType<typeof getMerchantOperationsDashboard>>["activity"]["recoveryAlerts"];
}>) {
  if (!alerts.length) return null;
  return <section className={styles.section} aria-labelledby="recovery-title">
    <h2 id="recovery-title">Recuperação automática</h2>
    <p className={styles.quiet}>Pendências técnicas que precisam de acompanhamento.</p>
    <div className={styles.rows}>
      {alerts.map(alert => <Link className={styles.attention} key={alert.id}
        to={alert.orderId ? "/admin/orders/$id" : "/admin/operations"}
        params={alert.orderId ? { id: alert.orderId } : undefined}>
        <span className={styles.warningDot} aria-hidden="true" />
        <strong>{alert.title}</strong>
        <span className={styles.action}>Ver detalhes</span>
      </Link>)}
    </div>
  </section>;
}

function RecentOrders({ orders }: Readonly<{
  orders: Awaited<ReturnType<typeof getMerchantOperationsDashboard>>["activity"]["recentOrders"];
}>) {
  return <>
      <section className={styles.section} aria-labelledby="recent-title">
        <div className={styles.sectionTitle}>
          <h2 id="recent-title">Últimos pedidos</h2>
          <Link to="/admin/orders">Ver todos os pedidos</Link>
        </div>
        <div className={styles.rows}>
          {orders.slice(0, 5).map(order =>
            <Link className={styles.order} key={order.id} to="/admin/orders/$id"
              params={{ id: order.id }}>
              <span><strong>#{String(order.orderNumber).padStart(5, "0")}</strong>
                <span> · {order.customerName ?? "Cliente"}</span></span>
              <span className={styles.orderStatus}><span className={styles.statusDot} />
                {statusLabel(order.status)}</span>
              <time>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</time>
              <strong className={styles.amount}>{formatMoney(order.totalCents)}</strong>
            </Link>)}
          {!orders.length
            ? <p className={styles.quiet}>Ainda não há pedidos. Quando alguém comprar, aparece aqui.</p>
            : null}
        </div>
      </section>
  </>;
}

function Metric({ label, value, hint }: Readonly<{
  label: string;
  value: string | number;
  hint: string;
}>) {
  return <div className={styles.metric}>
    <span>{label}</span><strong>{value}</strong><small>{hint}</small>
  </div>;
}
