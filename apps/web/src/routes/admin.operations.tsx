import { createFileRoute } from "@tanstack/react-router";
import type { InventoryPage } from "@white-label/inventory";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { MerchantOperationsPage } from "../features/store-admin/merchant-operations-page.tsx";
import { monthRange } from "../features/store-admin/merchant-operations-utils.ts";
import { listMerchantInventory } from "../lib/server/operations-inventory.functions.ts";
import {
  getMerchantOperationsAccess,
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

interface OperationsAccess {
  suppliers: boolean;
  purchases: boolean;
  finance: boolean;
  inventory: boolean;
  tasks: boolean;
}

interface OperationsLoaderData {
  access: OperationsAccess;
  suppliers: Page<Supplier>;
  supplierOptions: Supplier[];
  purchases: Page<Purchase>;
  inventory: InventoryPage;
  finance: Page<FinancialEntry>;
  financeSummary: FinanceSummary;
  categories: FinancialCategory[];
  tasks: MerchantTask[];
}

function emptyPage<T>(pageSize: number): Page<T> {
  return { items: [], page: 1, pageSize, total: 0 };
}

function emptyInventory(): InventoryPage {
  return { items: [], page: 1, pageSize: 100, total: 0 };
}

function emptyFinanceSummary(): FinanceSummary {
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

export const Route = createFileRoute("/admin/operations")({
  loader: async (): Promise<OperationsLoaderData> => {
    const access = await getMerchantOperationsAccess();
    const range = monthRange();
    const [suppliers, supplierOptions, purchases, inventory, finance, financeSummary, categories, tasks] = await Promise.all([
      access.suppliers ? listMerchantSuppliers({ data: { page: 1, pageSize: 25 } }) : Promise.resolve(emptyPage<Supplier>(25)),
      access.suppliers && access.purchases ? listMerchantSuppliers({ data: { page: 1, pageSize: 100 } }) : Promise.resolve(emptyPage<Supplier>(100)),
      access.purchases ? listMerchantPurchases({ data: { page: 1, pageSize: 25 } }) : Promise.resolve(emptyPage<Purchase>(25)),
      access.purchases && access.inventory ? listMerchantInventory({ data: { page: 1, pageSize: 100 } }) : Promise.resolve(emptyInventory()),
      access.finance ? listMerchantFinance({ data: { page: 1, pageSize: 25, from: range.from, to: range.to } }) : Promise.resolve(emptyPage<FinancialEntry>(25)),
      access.finance ? summarizeMerchantFinance({ data: range }) : Promise.resolve(emptyFinanceSummary()),
      access.finance ? listMerchantFinancialCategories() : Promise.resolve([]),
      access.tasks ? listMerchantTasks() : Promise.resolve([]),
    ]);
    return { access, suppliers, supplierOptions: supplierOptions.items, purchases, inventory, finance, financeSummary, categories, tasks };
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
      access={data.access}
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
