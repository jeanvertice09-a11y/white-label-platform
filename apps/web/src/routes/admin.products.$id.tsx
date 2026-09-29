import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { ProductImageManager } from "../features/store-admin/product-image-manager.tsx";
import { VariantEditor } from "../features/store-admin/variant-editor.tsx";
import { VariantGenerator } from "../features/store-admin/variant-generator.tsx";
import { getMerchantProduct, listMerchantCategories } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products/$id")({
  loader: async ({ params }) => {
    const [product, categories] = await Promise.all([getMerchantProduct({ data: { id: params.id } }), listMerchantCategories()]);
    if (!product) throw new Error("Produto não encontrado nesta loja");
    return { product, categories };
  },
  pendingComponent: () => <EmptyState title="Carregando produto" description="Buscando informações, fotos e variações." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível abrir o produto" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: EditProductPage,
});

function EditProductPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title={data.product.name} description="Edite informações, fotos, opções, variações e estoque sem recriar o produto." action={<Link className="k-button" to="/admin/products">Voltar aos produtos</Link>} /><ProductForm product={data.product} categories={data.categories} /><ProductImageManager product={data.product} /><VariantGenerator productId={data.product.id} variants={data.product.variants} basePriceCents={data.product.priceCents} /><VariantEditor productId={data.product.id} variants={data.product.variants} /></>;
}
