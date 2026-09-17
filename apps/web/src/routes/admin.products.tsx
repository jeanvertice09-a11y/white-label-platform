import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { AdminPage, Card, EmptyState, Money, buttonStyle } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/products")({
  loader: () => getMerchantCatalogOverview(),
  component: ProductsPage,
});

function ProductsPage(): React.JSX.Element {
  const data = Route.useLoaderData();

  return (
    <AdminPage
      title="Produtos"
      description="Gerencie produtos, preços, estoque e variantes."
      actions={<a href="/admin/products/new" style={{ ...buttonStyle, textDecoration: "none" }}>Novo produto</a>}
    >
      <Card>
        {data.products.items.length === 0 ? (
          <EmptyState title="Nenhum produto" text="Cadastre o primeiro produto da sua loja." />
        ) : (
          <div style={{ display: "grid" }}>
            {data.products.items.map((product) => (
              <a
                key={product.id}
                href={"/admin/products/" + product.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: "1px solid #f3f4f6",
                  color: "#111827",
                  textDecoration: "none",
                }}
              >
                <div>
                  <strong>{product.name}</strong>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>{product.sku ?? "Sem SKU"}</div>
                </div>
                <span style={{ color: product.active ? "#166534" : "#6b7280", fontSize: 13 }}>
                  {product.active ? "Ativo" : "Inativo"}
                </span>
                <strong><Money cents={product.priceCents} /></strong>
              </a>
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
