import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { listMerchantCategories } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products/new")({
  loader: () => listMerchantCategories(),
  component: NewProductPage,
});

function NewProductPage(): React.JSX.Element {
  const categories = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title="Novo produto" description="Cadastre as informações comerciais do produto." />
      <ProductForm product={null} categories={categories} />
    </div>
  );
}
