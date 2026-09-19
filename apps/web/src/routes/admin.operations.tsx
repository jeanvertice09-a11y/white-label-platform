import { createFileRoute } from "@tanstack/react-router";
import type { InventoryPage } from "@white-label/inventory";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { MerchantOperationsPage } from "../features/store-admin/merchant-operations-page.tsx";
import { monthRange } from "../features/store-admin/merchant-operations-utils.ts";
import { listMerchantInventory } from "../lib/server/operations-inventory.functions.ts";
import {
  listMerchantFinance,
  listMerchantFinancialCategories,
  listMerchantPurchases,
  listMerchantSuppliers,
  listMerchantTasks,
  summarizeMerchantFinance,
} from "../lib/server/operations-merchant.functions.ts";
import type {
  FinanceSummary,
  FinancialCategory,
  FinancialEntry,
  MerchantTask,
  Page,
  Purchase,
  Supplier,
} from "../../../../packages/merchant-ops/src/types.ts";

interface OperationsLoaderData {
  suppliers: Page<Supplier>;
  supplierOptions: Supplier[];
  purchases: Page<Purchase>;
  inventory: InventoryPage;
  finance: Page<FinancialEntry>;
  financeSummary: FinanceSummary;
  categories: FinancialCategory[];
  tasks: MerchantTask[];
}

export const Route = createFileRoute("/admin/operations")({
  loader: async (): Promise<OperationsLoaderData> => {
    const range = monthRange();
    const [suppliers, supplierOptions, purchases, inventory, finance, financeSummary, categories, tasks] = await Promise.all([
      listMerchantSuppliers({ data: { page: 1, pageSize: 25 } }),
      listMerchantSuppliers({ data: { page: 1, pageSize: 100 } }),
      listMerchantPurchases({ data: { page: 1, pageSize: 25 } }),
      listMerchantInventory({ data: { page: 1, pageSize: 100 } }),
      listMerchantFinance({ data: { page: 1, pageSize: 25, from: range.from, to: range.to } }),
      summarizeMerchantFinance({ data: range }),
      listMerchantFinancialCategories(),
      listMerchantTasks(),
    ]);
    return { suppliers, supplierOptions: supplierOptions.items, purchases, inventory, finance, financeSummary, categories, tasks };
  },
  pendingComponent: OperationsPending,
  errorComponent: OperationsError,
  component: OperationsRoutePage,
});

function OperationsPending(): React.JSX.Element {
  return <div className="k-empty">Carregando operações da loja…</div>;
}

function OperationsError(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = props.error instanceof Error ? props.error.message : "Não foi possível carregar as operações.";
  return <div className="k-empty"><strong>Operações indisponíveis</strong><span>{message}</span></div>;
}

function OperationsRoutePage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Operações" description="Fornecedores, compras, financeiro interno e tarefas da loja em um único espaço operacional." />
    <MerchantOperationsPage
      suppliers={data.suppliers}
      supplierOptions={data.supplierOptions}
      purchases={data.purchases}
      inventory={data.inventory}
      finance={data.finance}
      financeSummary={data.financeSummary}
      categories={data.categories}
      tasks={data.tasks}
    />
  </div>;
}
