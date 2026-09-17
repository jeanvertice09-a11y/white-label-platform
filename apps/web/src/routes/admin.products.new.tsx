import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { AdminPage } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/products/new")({
  loader: () => getMerchantCatalogOverview(),
  component: NewProductPage,
});

function NewProductPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <AdminPage title="Novo produto" description="Cadastre um produto real no catálogo da sua loja.">
      <ProductForm categories={data.categories} />
    </AdminPage>
  );
}
