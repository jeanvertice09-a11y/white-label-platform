import { createFileRoute } from "@tanstack/react-router";
import { MasterEmptyState, MasterMetricCard, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { masterDate, masterMoney } from "../components/master/format.ts";
import { getMasterConsoleData } from "../lib/server/platform-console.functions.ts";

export const Route = createFileRoute("/master/billing")({
  loader: () => getMasterConsoleData(),
  component: MasterBilling,
});

function MasterBilling() {
  const data = Route.useLoaderData();
  const open = data.payments.filter((payment) => payment.status === "pending").length;
  return (
    <div className="master-stack">
      <MasterPageHeader title="Faturamento" description="Cobranças reais do nível platform_billing." />
      <div className="master-metrics">
        <MasterMetricCard label="Receita recebida" value={masterMoney(data.metrics.paidCents)} detail="Status paid" />
        <MasterMetricCard label="Assinaturas ativas" value={String(data.metrics.activeSubscriptions)} detail="platform_billing" />
        <MasterMetricCard label="Pagamentos pendentes" value={String(open)} detail="Status pending" />
      </div>
      <MasterPanel title="Pagamentos recentes">
        {data.payments.length ? <div className="master-table-wrap"><table className="master-table">
          <thead><tr><th>White Label</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
          <tbody>{data.payments.map((payment) => (
            <tr key={payment.id}><td>{payment.tenantName ?? "Tenant removido"}</td><td>{payment.status}</td><td>{masterMoney(payment.amountCents)}</td><td>{masterDate(payment.createdAt)}</td></tr>
          ))}</tbody>
        </table></div> : <MasterEmptyState title="Sem pagamentos" description="Nenhum pagamento platform_billing foi registrado." />}
      </MasterPanel>
    </div>
  );
}
