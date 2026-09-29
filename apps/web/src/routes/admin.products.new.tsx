import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { ProductCreateWizard } from "../features/store-admin/product-create-wizard.tsx";
import { listMerchantCategories } from "../lib/server/catalog.functions.ts";
import {
  AdminRouteError,
  AdminRoutePending,
} from "../features/store-admin/admin-route-state.tsx";
export const Route = createFileRoute("/admin/products/new")({
  loader: () => listMerchantCategories(),
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: NewProductPage,
});
function NewProductPage(): React.JSX.Element {
  const categories = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Adicionar produto"
        description="Monte o produto inteiro e salve uma única vez no final. Você pode ir e voltar entre as etapas sem perder o que preencheu."
      />
      <ProductCreateWizard categories={categories} />
    </div>
  );
}
