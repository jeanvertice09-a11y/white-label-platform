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
  return <div className="master-stack">
    <MasterPageHeader title="Faturamento" description="Billing real Kataluu → White Label no nível platform_billing." />
    <BillingMetrics data={data}/>
    <TenantSubscriptions tenants={data.tenants}/>
    <RecentPayments payments={data.payments}/>
  </div>;
}

function BillingMetrics({ data }: Readonly<{ data: MasterConsoleData }>): React.JSX.Element {
  const pending = data.payments.filter((payment) => payment.status === "pending").length;
  return <div className="master-metrics">
    <MasterMetricCard icon="revenue" label="Pagamentos capturados" value={masterMoney(data.metrics.paidCents)} detail="Somente status captured" />
    <MasterMetricCard icon="subscriptions" label="Assinaturas ativas" value={String(data.metrics.activeSubscriptions)} detail="platform_billing" />
    <MasterMetricCard icon="billing" label="Pagamentos pendentes" value={String(pending)} detail="Status pending" />
  </div>;
}

function TenantSubscriptions({ tenants }: Readonly<{ tenants: MasterConsoleData["tenants"] }>): React.JSX.Element {
  return <MasterPanel title="White Labels e assinatura Kataluu"><div className="master-table-wrap"><table className="master-table">
    <thead><tr><th>White Label</th><th>Tenant</th><th>Plano</th><th>Assinatura</th><th>Trial</th><th>Período até</th></tr></thead>
    <tbody>{tenants.map((tenant) => <tr key={tenant.id}>
      <td>{tenant.name}</td><td>{tenant.status}</td>
      <td>{tenant.planName ?? "—"}{tenant.planPriceCents === null ? null : <small>{masterMoney(tenant.planPriceCents)} · {tenant.billingInterval ?? "intervalo pendente"}</small>}</td>
      <td>{tenant.subscriptionStatus ?? "—"}</td>
      <td>{dateValue(tenant.subscriptionTrialEndsAt ?? tenant.trialEndsAt)}</td>
      <td>{dateValue(tenant.currentPeriodEndsAt)}</td>
    </tr>)}</tbody>
  </table></div></MasterPanel>;
}

function RecentPayments({ payments }: Readonly<{ payments: MasterConsoleData["payments"] }>): React.JSX.Element {
  return <MasterPanel title="Pagamentos recentes">{payments.length ? <div className="master-table-wrap"><table className="master-table">
    <thead><tr><th>White Label</th><th>Provider</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
    <tbody>{payments.map((payment) => <tr key={payment.id}>
      <td>{payment.tenantName ?? "Tenant removido"}</td><td>{payment.provider ?? "—"}</td><td>{payment.status}</td><td>{masterMoney(payment.amountCents)}</td><td>{masterDate(payment.createdAt)}</td>
    </tr>)}</tbody>
  </table></div> : <MasterEmptyState title="Sem pagamentos" description="Nenhum pagamento platform_billing foi registrado." />}</MasterPanel>;
}

function dateValue(value: string | null): string { return value ? masterDate(value) : "—"; }
