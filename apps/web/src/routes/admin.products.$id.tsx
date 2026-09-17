import { createFileRoute } from "@tanstack/react-router";
import {
  getMerchantCatalogOverview,
  getMerchantProduct,
} from "../lib/server/catalog.functions.ts";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { VariantEditor } from "../features/store-admin/variant-editor.tsx";
import { AdminPage, Card, EmptyState } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/products/$id")({
  loader: async ({ params }) => {
    const [overview, product] = await Promise.all([
      getMerchantCatalogOverview(),
      getMerchantProduct({ data: { id: params.id } }),
    ]);
    return { overview, product };
  },
  component: EditProductPage,
});

function EditProductPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  if (!data.product) {
    return (
      <AdminPage title="Produto não encontrado" description="O produto não pertence a esta loja ou não existe.">
        <Card><EmptyState title="Produto indisponível" text="Volte para a lista de produtos." /></Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage title={data.product.name} description="Edite o produto e suas variantes.">
      <ProductForm product={data.product} categories={data.overview.categories} />
      <section>
        <h2>Variantes</h2>
        <VariantEditor productId={data.product.id} variants={data.product.variants} />
      </section>
    </AdminPage>
  );
}
