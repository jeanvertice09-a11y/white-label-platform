import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterMetricCard,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";
import { masterDate, masterMoney } from "../components/master/format.ts";
import { getMasterConsoleData } from "../lib/server/platform-console.functions.ts";
import type { MasterConsoleData } from "../lib/server/platform-console.types.ts";

export const Route = createFileRoute("/master/billing")({
  loader: () => getMasterConsoleData(),
  component: MasterBilling,
});

function MasterBilling(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <div className="master-stack console-page">
      <MasterPageHeader title="Faturamento" description="Cobranças Kataluu → White Label, com períodos, pagamentos e situação de cada plataforma." />
      <BillingMetrics data={data} />
      <TenantSubscriptions tenants={data.tenants} />
      <RecentPayments payments={data.payments} />
    </div>
  );
}

function BillingMetrics({ data }: Readonly<{ data: MasterConsoleData }>): React.JSX.Element {
  const pending = data.payments.filter((payment) => payment.status === "pending").length;
  return (
    <div className="master-metrics master-summary-surface" aria-label="Resumo financeiro">
      <MasterMetricCard icon="revenue" label="Recebido" value={masterMoney(data.metrics.paidCents)} detail="Pagamentos capturados" />
      <MasterMetricCard icon="subscriptions" label="Assinaturas ativas" value={String(data.metrics.activeSubscriptions)} detail="platform_billing" />
      <MasterMetricCard icon="billing" label="Pagamentos pendentes" value={String(pending)} detail="Aguardando confirmação" />
      <MasterMetricCard icon="platforms" label="White Labels" value={String(data.metrics.tenants)} detail="Base faturável cadastrada" />
    </div>
  );
}

function TenantSubscriptions({ tenants }: Readonly<{ tenants: MasterConsoleData["tenants"] }>): React.JSX.Element {
  return (
    <MasterPanel title="Assinaturas das White Labels">
      <div className="master-table-wrap">
        <table className="master-table">
          <thead><tr><th>White Label</th><th>Tenant</th><th>Plano</th><th>Assinatura</th><th>Trial</th><th>Período até</th></tr></thead>
          <tbody>{tenants.map((tenant) => (
            <tr key={tenant.id}>
              <td><strong>{tenant.name}</strong><small>{tenant.slug}</small></td>
              <td><span className="console-status">{tenant.status}</span></td>
              <td>{tenant.planName ?? "—"}{tenant.planPriceCents === null ? null : <small>{masterMoney(tenant.planPriceCents)} · {tenant.billingInterval ?? "intervalo pendente"}</small>}</td>
              <td>{tenant.subscriptionStatus ? <span className="console-status">{tenant.subscriptionStatus}</span> : "—"}</td>
              <td>{dateValue(tenant.subscriptionTrialEndsAt ?? tenant.trialEndsAt)}</td>
              <td>{dateValue(tenant.currentPeriodEndsAt)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </MasterPanel>
  );
}

function RecentPayments({ payments }: Readonly<{ payments: MasterConsoleData["payments"] }>): React.JSX.Element {
  return (
    <MasterPanel title="Pagamentos recentes">
      {payments.length ? (
        <div className="master-table-wrap">
          <table className="master-table">
            <thead><tr><th>White Label</th><th>Provider</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
            <tbody>{payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.tenantName ?? "Tenant removido"}</td>
                <td>{payment.provider ?? "—"}</td>
                <td><span className="console-status">{payment.status}</span></td>
                <td className="console-money">{masterMoney(payment.amountCents)}</td>
                <td>{masterDate(payment.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <MasterEmptyState title="Sem pagamentos" description="Nenhum pagamento platform_billing foi registrado." />}
    </MasterPanel>
  );
}

function dateValue(value: string | null): string {
  return value ? masterDate(value) : "—";
}
