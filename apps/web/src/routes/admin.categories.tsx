import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { CategoryManager } from "../features/store-admin/category-manager.tsx";
import { listMerchantCategories } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/categories")({
  loader: () => listMerchantCategories(),
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: CategoriesPage,
});

function CategoriesPage(): React.JSX.Element {
  const categories = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Categorias"
        description="Organize categorias e subcategorias sem permitir referências entre lojas."
      />
      <CategoryManager categories={categories} />
    </div>
  );
}
