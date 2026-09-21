import { useEffect, useState } from "react";
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

function tabFromHash(access: OperationsAccess): Tab {
  if (typeof window === "undefined") return initialTab(access);
  const value = window.location.hash.replace(/^#/, "");
  if (value === "purchases" && access.purchases) return "purchases";
  if (value === "suppliers" && access.suppliers) return "suppliers";
  if (value === "finance" && access.finance) return "finance";
  if (value === "tasks" && access.tasks) return "tasks";
  return initialTab(access);
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

  useEffect(() => {
    function syncHash(): void {
      setTab(tabFromHash(props.access));
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => { window.removeEventListener("hashchange", syncHash); };
  }, [props.access]);

  function selectTab(next: Tab): void {
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${next}`);
    }
  }

  return <div className="k-workspace">
    <nav className="k-toolbar" aria-label="Áreas da loja">
      {props.access.finance ? <button className={tab === "finance" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { selectTab("finance"); }}>Visão financeira</button> : null}
      {props.access.purchases ? <button className={tab === "purchases" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { selectTab("purchases"); }}>Compras</button> : null}
      {props.access.suppliers ? <button className={tab === "suppliers" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { selectTab("suppliers"); }}>Fornecedores</button> : null}
      {props.access.tasks ? <button className={tab === "tasks" ? "k-button k-button--primary" : "k-button"} type="button" onClick={() => { selectTab("tasks"); }}>Tarefas</button> : null}
    </nav>
    {props.access.purchases && tab === "purchases" ? <MerchantPurchasesManager initial={props.purchases} suppliers={props.supplierOptions} inventory={props.inventory} inventoryEnabled={props.access.inventory} /> : null}
    {props.access.suppliers && tab === "suppliers" ? <MerchantSuppliersManager initial={props.suppliers} /> : null}
    {props.access.finance && tab === "finance" ? <MerchantFinanceManager initial={props.finance} initialSummary={props.financeSummary} categories={props.categories} /> : null}
    {props.access.tasks && tab === "tasks" ? <MerchantTasksManager initial={props.tasks} /> : null}
  </div>;
}
