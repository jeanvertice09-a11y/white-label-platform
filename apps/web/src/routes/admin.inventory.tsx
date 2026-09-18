import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { InventoryManager } from "../features/store-admin/inventory-manager.tsx";
import {
  listMerchantInventory,
  listMerchantInventoryHistory,
} from "../lib/server/operations-inventory.functions.ts";

export const Route = createFileRoute("/admin/inventory")({
  loader: async () => {
    const [inventory, history] = await Promise.all([
      listMerchantInventory({ data: { page: 1, pageSize: 20 } }),
      listMerchantInventoryHistory({ data: { page: 1, pageSize: 20 } }),
    ]);
    return { inventory, history };
  },
  pendingComponent: InventoryPending,
  errorComponent: InventoryError,
  component: InventoryPage,
});

function InventoryPending(): React.JSX.Element {
  return <div className="k-empty">Carregando estoque…</div>;
}

function InventoryError(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = props.error instanceof Error ? props.error.message : "Não foi possível carregar o estoque.";
  return <div className="k-empty"><p>{message}</p></div>;
}

function InventoryPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Estoque"
        description="Consulte saldos, registre entradas, saídas e ajustes e acompanhe o histórico da loja."
      />
      <InventoryManager initialInventory={data.inventory} initialHistory={data.history} />
    </div>
  );
}
