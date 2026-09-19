import { useState } from "react";
import type { InventoryPage } from "@white-label/inventory";
import type {
  FinanceSummary,
  FinancialCategory,
  FinancialEntry,
  MerchantTask,
  Page,
  Purchase,
  Supplier,
} from "../../../../../packages/merchant-ops/src/types.ts";
import { MerchantFinanceManager } from "./merchant-finance-manager.tsx";
import { MerchantPurchasesManager } from "./merchant-purchases-manager.tsx";
import { MerchantSuppliersManager } from "./merchant-suppliers-manager.tsx";
import { MerchantTasksManager } from "./merchant-tasks-manager.tsx";

type Tab = "suppliers" | "purchases" | "finance" | "tasks";

export function MerchantOperationsPage(props: Readonly<{
  suppliers: Page<Supplier>;
  supplierOptions: Supplier[];
  purchases: Page<Purchase>;
  inventory: InventoryPage;
  finance: Page<FinancialEntry>;
  financeSummary: FinanceSummary;
  categories: FinancialCategory[];
  tasks: MerchantTask[];
}>): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("purchases");
  return <div className="k-workspace">
    <nav className="k-toolbar" aria-label="Áreas operacionais">
      <button className={tab === "purchases" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("purchases"); }}>Compras</button>
      <button className={tab === "suppliers" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("suppliers"); }}>Fornecedores</button>
      <button className={tab === "finance" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("finance"); }}>Financeiro</button>
      <button className={tab === "tasks" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("tasks"); }}>Tarefas</button>
    </nav>
    {tab === "purchases" ? <MerchantPurchasesManager initial={props.purchases} suppliers={props.supplierOptions} inventory={props.inventory} /> : null}
    {tab === "suppliers" ? <MerchantSuppliersManager initial={props.suppliers} /> : null}
    {tab === "finance" ? <MerchantFinanceManager initial={props.finance} initialSummary={props.financeSummary} categories={props.categories} /> : null}
    {tab === "tasks" ? <MerchantTasksManager initial={props.tasks} /> : null}
  </div>;
}
