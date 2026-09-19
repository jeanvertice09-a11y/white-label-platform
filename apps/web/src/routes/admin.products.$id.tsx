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
      <PageHead
        title={data.product.name}
        description="Edite conteúdo, preço, publicação e organização do produto."
        action={<Link className="k-button" to="/admin/inventory">Gerenciar estoque</Link>}
      />
      <ProductForm product={data.product} categories={data.categories} />
      <VariantEditor productId={data.product.id} variants={data.product.variants} />
      <section className="k-workspace-section">
        <header className="k-section-head">
          <div>
            <span className="k-section-kicker">Mídia</span>
            <h2>Imagens do produto</h2>
            <p>
              {data.product.images.length
                ? `${String(data.product.images.length)} imagem(ns) associada(s) e disponível(is) no catálogo.`
                : "Nenhuma imagem associada. O upload/storage administrativo completo permanece fora desta fase."}
            </p>
          </div>
          <span className="k-section-count">{data.product.images.length} imagem(ns)</span>
        </header>
      </section>
    </div>
  );
}
