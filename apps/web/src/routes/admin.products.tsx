import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { formatMoney } from "../features/store-admin/format.ts";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products")({
  loader: () => getMerchantCatalogOverview(),
  component: ProductsPage,
});

function ProductsPage() {
  const data = Route.useLoaderData();
  const products = data.products.items;
  return (
    <div className="k-page">
      <PageHead
        title="Produtos"
        description="Cadastre produtos, preços, estoque e variantes da loja."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />
      {products.length ? (
        <div className="k-card k-table-wrap">
          <table className="k-table">
            <thead><tr><th>Produto</th><th>Preço</th><th>Variantes</th><th>Status</th><th /></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong><div className="k-row__meta">{product.sku || "Sem SKU"}</div></td>
                  <td>{formatMoney(product.priceCents)}</td>
                  <td>{product.variants.length}</td>
                  <td><span className={product.active ? "k-badge k-badge--on" : "k-badge"}>{product.active ? "Ativo" : "Inativo"}</span></td>
                  <td><Link className="k-button" to="/admin/products/$id" params={{ id: product.id }}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="k-empty">
          <p>Nenhum produto cadastrado.</p>
          <Link className="k-button" to="/admin/products/new">Cadastrar primeiro produto</Link>
        </div>
      )}
    </div>
  );
}
