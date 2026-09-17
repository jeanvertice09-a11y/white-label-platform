import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { AdminPage, Card, EmptyState, Money, gridStyle } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/")({
  loader: () => getMerchantCatalogOverview(),
  component: Dashboard,
});

function Dashboard(): React.JSX.Element {
  const data = Route.useLoaderData();
  const activeProducts = data.products.items.filter((product) => product.active).length;

  return (
    <AdminPage
      title={data.store.name}
      description="Visão geral real da sua loja e do catálogo."
    >
      <div style={gridStyle}>
        <Card>
          <small style={{ color: "#6b7280" }}>Produtos cadastrados</small>
          <strong style={{ display: "block", fontSize: 28, marginTop: 6 }}>{data.products.total}</strong>
        </Card>
        <Card>
          <small style={{ color: "#6b7280" }}>Produtos ativos nesta página</small>
          <strong style={{ display: "block", fontSize: 28, marginTop: 6 }}>{activeProducts}</strong>
        </Card>
        <Card>
          <small style={{ color: "#6b7280" }}>Categorias</small>
          <strong style={{ display: "block", fontSize: 28, marginTop: 6 }}>{data.categories.length}</strong>
        </Card>
        <Card>
          <small style={{ color: "#6b7280" }}>Layout</small>
          <strong style={{ display: "block", fontSize: 22, marginTop: 6 }}>{data.settings.layout}</strong>
        </Card>
      </div>

      <Card>
        <h2 style={{ marginTop: 0 }}>Produtos recentes</h2>
        {data.products.items.length === 0 ? (
          <EmptyState title="Nenhum produto" text="Crie seu primeiro produto para começar o catálogo." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {data.products.items.slice(0, 5).map((product) => (
              <a
                key={product.id}
                href={"/admin/products/" + product.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  textDecoration: "none",
                  color: "#111827",
                  padding: "10px 0",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <span>{product.name}</span>
                <Money cents={product.priceCents} />
              </a>
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
