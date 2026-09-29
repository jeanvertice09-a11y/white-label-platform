import { createFileRoute, Link } from "@tanstack/react-router";
import type { FinanceSummary, FinancialCategory, FinancialEntry, Page } from "../../../../packages/merchant-ops/src/types.ts";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { MerchantFinanceManager } from "../features/store-admin/merchant-finance-manager.tsx";
import { monthRange } from "../features/store-admin/merchant-operations-utils.ts";
import { getMerchantOperationsAccess, listMerchantFinance, listMerchantFinancialCategories, summarizeMerchantFinance } from "../lib/server/operations-merchant.functions.ts";

interface FinanceLoaderData { enabled: boolean; finance: Page<FinancialEntry>; summary: FinanceSummary; categories: FinancialCategory[] }
function emptyPage(): Page<FinancialEntry> { return { items: [], page: 1, pageSize: 25, total: 0 }; }
function emptySummary(): FinanceSummary { return { openReceivableCents: 0, overdueReceivableCents: 0, openPayableCents: 0, overduePayableCents: 0, receivedCents: 0, paidCents: 0, cashFlowCents: 0, competenceReceivableCents: 0, competencePayableCents: 0, managerialResultCents: 0 }; }

export const Route = createFileRoute("/admin/finance")({
  loader: async (): Promise<FinanceLoaderData> => {
    const access = await getMerchantOperationsAccess();
    if (!access.finance) return { enabled: false, finance: emptyPage(), summary: emptySummary(), categories: [] };
    const range = monthRange();
    const [finance, summary, categories] = await Promise.all([listMerchantFinance({ data: { page: 1, pageSize: 25, from: range.from, to: range.to } }), summarizeMerchantFinance({ data: range }), listMerchantFinancialCategories()]);
    return { enabled: true, finance, summary, categories };
  },
  pendingComponent: () => <EmptyState title="Carregando financeiro" description="Buscando lançamentos e resumo financeiro." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar o financeiro" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: FinancePage,
});

function FinancePage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title="Visão financeira" description="Acompanhe contas a receber, contas a pagar e o resultado gerencial registrado na loja." /><nav className="adminFinanceTabs" aria-label="Áreas financeiras"><Link to="/admin/finance" activeOptions={{ exact: true }}>Lançamentos</Link><Link to="/admin/purchases">Compras e despesas</Link><Link to="/admin/suppliers">Fornecedores</Link></nav>{data.enabled ? <MerchantFinanceManager initial={data.finance} initialSummary={data.summary} categories={data.categories} /> : <EmptyState title="Financeiro indisponível" description="Este recurso não está habilitado para o plano atual da loja." />}</>;
}
