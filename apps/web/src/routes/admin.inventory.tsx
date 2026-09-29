import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { InventoryManager } from "../features/store-admin/inventory-manager.tsx";
import { listMerchantInventory, listMerchantInventoryHistory } from "../lib/server/operations-inventory.functions.ts";

export const Route = createFileRoute("/admin/inventory")({
  loader: async () => {
    const [inventory, history] = await Promise.all([
      listMerchantInventory({ data: { page: 1, pageSize: 20 } }),
      listMerchantInventoryHistory({ data: { page: 1, pageSize: 20 } }),
    ]);
    return { inventory, history };
  },
  pendingComponent: () => <EmptyState title="Carregando estoque" description="Buscando quantidades e movimentações." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar o estoque" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: InventoryPage,
});

function InventoryPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title="Estoque" description="Veja o que está acabando e atualize as quantidades quando receber ou retirar produtos." /><InventoryManager initialInventory={data.inventory} initialHistory={data.history} /></>;
}
