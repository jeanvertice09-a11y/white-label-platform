import { createFileRoute } from "@tanstack/react-router";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
import { CategoriesPanel } from "../features/store-admin/categories-panel.tsx";
import { AdminPage } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/categories")({
  loader: () => getMerchantCatalogOverview(),
  component: CategoriesPage,
});

function CategoriesPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <AdminPage title="Categorias" description="Organize categorias e subcategorias da sua loja.">
      <CategoriesPanel categories={data.categories} />
    </AdminPage>
  );
}
