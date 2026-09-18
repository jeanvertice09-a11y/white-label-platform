import { createFileRoute } from "@tanstack/react-router";
import { InventoryAdjustment } from "../features/store-admin/inventory-adjustment.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { listMerchantInventory } from "../lib/server/operations-inventory.functions.ts";

export const Route = createFileRoute("/admin/inventory")({
  loader: () => listMerchantInventory(),
  component: InventoryPage,
});

function InventoryPage(): React.JSX.Element {
  const items = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title="Estoque" description="Saldo canônico calculado pelo ledger de movimentações da loja." />
      {items.length ? (
        <div className="k-card k-table-wrap">
          <table className="k-table">
            <thead><tr><th>Produto</th><th>SKU</th><th>Saldo</th><th>Ajuste</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId + ":" + (item.variantId ?? "base")}>
                  <td><strong>{item.productName}</strong>{item.variantName ? <div className="k-row__meta">{item.variantName}</div> : null}</td>
                  <td>{item.sku ?? "—"}</td>
                  <td><span className={item.currentQuantity <= 5 ? "k-badge" : "k-badge k-badge--on"}>{item.trackInventory ? item.currentQuantity : "Não controlado"}</span></td>
                  <td>{item.trackInventory ? <InventoryAdjustment productId={item.productId} variantId={item.variantId} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="k-empty">Nenhum item de estoque disponível.</div>}
    </div>
  );
}
