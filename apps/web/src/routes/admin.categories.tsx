import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { CategoryManager } from "../features/store-admin/category-manager.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/categories")({
  loader: () => getMerchantCatalogOverview(),
  component: CategoriesPage,
});

function CategoriesPage() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Categorias"
        description="Organize categorias e subcategorias sem permitir referências entre lojas."
      />
      <CategoryManager categories={data.categories} />
    </div>
  );
}
