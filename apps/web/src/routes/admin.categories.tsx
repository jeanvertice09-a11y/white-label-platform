import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CategoryManager } from "../features/store-admin/category-manager.tsx";
import { listMerchantCategories } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/categories")({
  loader: () => listMerchantCategories(),
  pendingComponent: () => <EmptyState title="Carregando categorias" description="Buscando a organização da sua vitrine." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar as categorias" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: CategoriesPage,
});

function CategoriesPage(): React.JSX.Element {
  const categories = Route.useLoaderData();
  return <><PageHeader title="Categorias" description="Organize categorias e subcategorias da sua loja." /><CategoryManager categories={categories} /></>;
}
