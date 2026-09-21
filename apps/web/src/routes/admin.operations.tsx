import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { MerchantOperationsReportView } from "../features/store-admin/merchant-operations-report.tsx";
import { getMerchantOperationsReport } from "../lib/server/operations-dashboard.functions.ts";

export const Route = createFileRoute("/admin/operations")({
  loader: () => getMerchantOperationsReport({ data: {} }),
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: OperationsRoutePage,
});

function OperationsRoutePage(): React.JSX.Element {
  const report = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Relatório operacional" description="Consolidação real de vendas, clientes, estoque, compras, fornecedores, tarefas e financeiro da loja." />
    <MerchantOperationsReportView initial={report} />
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Áreas operacionais</h2><p>Acesse os módulos existentes para trabalhar nos registros que compõem o relatório.</p></div></div>
      <div className="k-actions"><Link className="k-button" to="/admin/finance">Financeiro</Link><Link className="k-button" to="/admin/purchases">Compras</Link><Link className="k-button" to="/admin/suppliers">Fornecedores</Link><Link className="k-button" to="/admin/tasks">Tarefas</Link></div>
    </section>
  </div>;
}
