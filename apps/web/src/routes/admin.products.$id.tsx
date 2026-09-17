import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { VariantEditor } from "../features/store-admin/variant-editor.tsx";
import {
  getMerchantCatalogOverview,
  getMerchantProduct,
} from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products/$id")({
  loader: async ({ params }) => {
    const [product, overview] = await Promise.all([
      getMerchantProduct({ data: { id: params.id } }),
      getMerchantCatalogOverview(),
    ]);
    if (!product) throw notFound();
    return { product, categories: overview.categories };
  },
  component: EditProductPage,
});

function EditProductPage() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title={data.product.name} description="Edite o produto e suas variantes." />
      <ProductForm product={data.product} categories={data.categories} />
      <VariantEditor productId={data.product.id} variants={data.product.variants} />
    </div>
  );
}
