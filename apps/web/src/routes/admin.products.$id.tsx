import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { VariantEditor } from "../features/store-admin/variant-editor.tsx";
import {
  getMerchantProduct,
  listMerchantCategories,
} from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products/$id")({
  loader: async ({ params }) => {
    const [product, categories] = await Promise.all([
      getMerchantProduct({ data: { id: params.id } }),
      listMerchantCategories(),
    ]);
    if (!product) throw new Error("Produto não encontrado nesta loja");
    return { product, categories };
  },
  component: EditProductPage,
});

function EditProductPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title={data.product.name} description="Edite o produto e suas variantes." />
      <ProductForm product={data.product} categories={data.categories} />
      <VariantEditor productId={data.product.id} variants={data.product.variants} />
      <div className="k-actions"><Link className="k-button" to="/admin/inventory">Gerenciar estoque</Link></div>
      <div className="k-card">
        <h2>Imagens do produto</h2>
        <p className="k-muted">
          {data.product.images.length
            ? `${String(data.product.images.length)} imagem(ns) já associada(s) e disponível(is) no catálogo.`
            : "Nenhuma imagem associada. O upload/storage administrativo completo permanece fora desta fase."}
        </p>
      </div>
    </div>
  );
}
