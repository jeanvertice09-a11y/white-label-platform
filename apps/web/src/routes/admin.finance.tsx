import { createFileRoute } from "@tanstack/react-router";
import type { FinanceSummary, FinancialCategory, FinancialEntry, Page } from "../../../../packages/merchant-ops/src/types.ts";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminFeatureUnavailable, AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { MerchantFinanceManager } from "../features/store-admin/merchant-finance-manager.tsx";
import { monthRange } from "../features/store-admin/merchant-operations-utils.ts";
import {
  getMerchantOperationsAccess,
  listMerchantFinance,
  listMerchantFinancialCategories,
  summarizeMerchantFinance,
} from "../lib/server/operations-merchant.functions.ts";

interface FinanceLoaderData {
  enabled: boolean;
  finance: Page<FinancialEntry>;
  summary: FinanceSummary;
  categories: FinancialCategory[];
}

function emptyPage(): Page<FinancialEntry> {
  return { items: [], page: 1, pageSize: 25, total: 0 };
}

function emptySummary(): FinanceSummary {
  return {
    openReceivableCents: 0,
    overdueReceivableCents: 0,
    openPayableCents: 0,
    overduePayableCents: 0,
    receivedCents: 0,
    paidCents: 0,
    cashFlowCents: 0,
    competenceReceivableCents: 0,
    competencePayableCents: 0,
    managerialResultCents: 0,
  };
}

export const Route = createFileRoute("/admin/finance")({
  loader: async (): Promise<FinanceLoaderData> => {
    const access = await getMerchantOperationsAccess();
    if (!access.finance) {
      return { enabled: false, finance: emptyPage(), summary: emptySummary(), categories: [] };
    }
    const range = monthRange();
    const [finance, summary, categories] = await Promise.all([
      listMerchantFinance({ data: { page: 1, pageSize: 25, from: range.from, to: range.to } }),
      summarizeMerchantFinance({ data: range }),
      listMerchantFinancialCategories(),
    ]);
    return { enabled: true, finance, summary, categories };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: FinancePage,
});

function FinancePage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Visão financeira" description="Acompanhe contas a receber, contas a pagar e o resultado gerencial registrado na loja." />
    {data.enabled
      ? <MerchantFinanceManager initial={data.finance} initialSummary={data.summary} categories={data.categories} />
      : <AdminFeatureUnavailable title="Financeiro indisponível" description="Este recurso não está habilitado para o plano atual da loja." />}
  </div>;
}
