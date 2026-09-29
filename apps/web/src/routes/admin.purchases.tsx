import { createFileRoute } from "@tanstack/react-router";
import type { InventoryPage } from "@white-label/inventory";
import type { Page, Purchase, Supplier } from "../../../../packages/merchant-ops/src/types.ts";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { MerchantPurchasesManager } from "../features/store-admin/merchant-purchases-manager.tsx";
import { listMerchantInventory } from "../lib/server/operations-inventory.functions.ts";
import { getMerchantOperationsAccess, listMerchantPurchases, listMerchantSuppliers } from "../lib/server/operations-merchant.functions.ts";

interface PurchasesLoaderData { access: { purchases: boolean; suppliers: boolean; inventory: boolean }; purchases: Page<Purchase>; suppliers: Supplier[]; inventory: InventoryPage }
function emptyPage<T>(pageSize: number): Page<T> { return { items: [], page: 1, pageSize, total: 0 }; }
function emptyInventory(): InventoryPage { return { items: [], page: 1, pageSize: 100, total: 0 }; }

export const Route = createFileRoute("/admin/purchases")({
  loader: async (): Promise<PurchasesLoaderData> => {
    const access = await getMerchantOperationsAccess();
    if (!access.purchases) return { access, purchases: emptyPage<Purchase>(25), suppliers: [], inventory: emptyInventory() };
    const [purchases, supplierPage, inventory] = await Promise.all([
      listMerchantPurchases({ data: { page: 1, pageSize: 25 } }),
      access.suppliers ? listMerchantSuppliers({ data: { page: 1, pageSize: 100 } }) : Promise.resolve(emptyPage<Supplier>(100)),
      access.inventory ? listMerchantInventory({ data: { page: 1, pageSize: 100 } }) : Promise.resolve(emptyInventory()),
    ]);
    return { access, purchases, suppliers: supplierPage.items, inventory };
  },
  pendingComponent: () => <EmptyState title="Carregando compras" description="Buscando compras, fornecedores e estoque." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar as compras" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: PurchasesPage,
});

function PurchasesPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title="Compras" description="Registre compras, acompanhe recebimentos e integre a entrada de mercadorias ao estoque quando disponível." />{data.access.purchases ? <MerchantPurchasesManager initial={data.purchases} suppliers={data.suppliers} inventory={data.inventory} inventoryEnabled={data.access.inventory} /> : <EmptyState title="Compras indisponíveis" description="Este recurso não está habilitado para o plano atual da loja." />}</>;
}
