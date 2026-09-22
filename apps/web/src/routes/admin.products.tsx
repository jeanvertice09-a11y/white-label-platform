import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { BulkImportPanel } from "../features/store-admin/bulk-import-panel.tsx";
import { ProductsList } from "../features/store-admin/products-list.tsx";
import {
  listMerchantCategories,
  listMerchantProducts,
} from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products")({
  loader: async () => {
    const [categories, products] = await Promise.all([
      listMerchantCategories(),
      listMerchantProducts({ data: { page: 1, pageSize: 20, sort: "position" } }),
    ]);
    return { categories, products };
  },
  pendingComponent: ProductsPending,
  errorComponent: ProductsError,
  component: ProductsPage,
});

function ProductsPending(): React.JSX.Element {
  return <div className="k-empty">Carregando produtos…</div>;
}

function ProductsError(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = props.error instanceof Error ? props.error.message : "Não foi possível carregar os produtos.";
  return <div className="k-empty"><p>{message}</p></div>;
}

function ProductsPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Produtos"
        description="Cadastre, busque e gerencie produtos, preços, estoque e variantes da loja."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />
      <ProductsList initialPage={data.products} categories={data.categories} />
      <BulkImportPanel />
    </div>
  );
}
