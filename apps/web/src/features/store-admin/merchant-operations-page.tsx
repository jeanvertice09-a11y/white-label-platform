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
interface OperationsAccess {
  suppliers: boolean;
  purchases: boolean;
  finance: boolean;
  inventory: boolean;
  tasks: boolean;
}

function initialTab(access: OperationsAccess): Tab {
  if (access.purchases) return "purchases";
  if (access.suppliers) return "suppliers";
  if (access.finance) return "finance";
  return "tasks";
}

export function MerchantOperationsPage(props: Readonly<{
  access: OperationsAccess;
  suppliers: Page<Supplier>;
  supplierOptions: Supplier[];
  purchases: Page<Purchase>;
  inventory: InventoryPage;
  finance: Page<FinancialEntry>;
  financeSummary: FinanceSummary;
  categories: FinancialCategory[];
  tasks: MerchantTask[];
}>): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(() => initialTab(props.access));
  return <div className="k-workspace">
    <nav className="k-toolbar" aria-label="Áreas operacionais">
      {props.access.purchases ? <button className={tab === "purchases" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("purchases"); }}>Compras</button> : null}
      {props.access.suppliers ? <button className={tab === "suppliers" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("suppliers"); }}>Fornecedores</button> : null}
      {props.access.finance ? <button className={tab === "finance" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("finance"); }}>Financeiro</button> : null}
      {props.access.tasks ? <button className={tab === "tasks" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { setTab("tasks"); }}>Tarefas</button> : null}
    </nav>
    {props.access.purchases && tab === "purchases" ? <MerchantPurchasesManager initial={props.purchases} suppliers={props.supplierOptions} inventory={props.inventory} inventoryEnabled={props.access.inventory} /> : null}
    {props.access.suppliers && tab === "suppliers" ? <MerchantSuppliersManager initial={props.suppliers} /> : null}
    {props.access.finance && tab === "finance" ? <MerchantFinanceManager initial={props.finance} initialSummary={props.financeSummary} categories={props.categories} /> : null}
    {props.access.tasks && tab === "tasks" ? <MerchantTasksManager initial={props.tasks} /> : null}
  </div>;
}
