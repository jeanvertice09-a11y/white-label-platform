import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { MerchantOperationsReportView } from "../features/store-admin/merchant-operations-report.tsx";
import { getMerchantOperationalReport } from "../lib/server/merchant-reporting.functions.ts";

export const Route = createFileRoute("/admin/operations")({
  loader: () => getMerchantOperationalReport({ data: {} }),
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: OperationsRoutePage,
});

function OperationsRoutePage(): React.JSX.Element {
  const report = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Relatórios operacionais" description="Vendas, clientes, produtos, compras e financeiro com dados reais da loja e filtros por período." />
    <MerchantOperationsReportView initial={report} />
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Áreas operacionais</h2><p>Acesse os módulos existentes para trabalhar nos registros que compõem estes relatórios.</p></div></div>
      <div className="k-actions"><Link className="k-button" to="/admin/finance">Financeiro</Link><Link className="k-button" to="/admin/customers">Clientes</Link><Link className="k-button" to="/admin/purchases">Compras</Link><Link className="k-button" to="/admin/suppliers">Fornecedores</Link></div>
    </section>
  </div>;
}
