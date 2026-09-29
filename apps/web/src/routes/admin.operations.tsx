import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { Section } from "../admin/ui/Section.tsx";
import { MerchantAuditLog } from "../features/store-admin/merchant-audit-log.tsx";
import { MerchantOperationsReportView } from "../features/store-admin/merchant-operations-report.tsx";
import { listMerchantAudit } from "../lib/server/merchant-audit.functions.ts";
import { getMerchantOperationalReport } from "../lib/server/merchant-reporting.functions.ts";

export const Route = createFileRoute("/admin/operations")({
  loader: async () => { const [report, audit] = await Promise.all([getMerchantOperationalReport({ data: {} }), listMerchantAudit({ data: { page: 1, pageSize: 25 } })]); return { report, audit }; },
  pendingComponent: () => <EmptyState title="Carregando operação" description="Consolidando relatórios e auditoria da loja." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar a operação" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: OperationsRoutePage,
});
function OperationsRoutePage(): React.JSX.Element { const data = Route.useLoaderData(); return <><PageHeader title="Relatórios operacionais" description="Vendas, clientes, produtos, compras e financeiro com dados reais da loja e filtros por período." /><MerchantOperationsReportView initial={data.report} /><MerchantAuditLog initial={data.audit} /><Section title="Áreas operacionais" description="Acesse os módulos que alimentam estes relatórios."><div className="k-actions"><Link className="k-button" to="/admin/finance">Financeiro</Link><Link className="k-button" to="/admin/customers">Clientes</Link><Link className="k-button" to="/admin/purchases">Compras</Link><Link className="k-button" to="/admin/suppliers">Fornecedores</Link></div></Section></>; }
