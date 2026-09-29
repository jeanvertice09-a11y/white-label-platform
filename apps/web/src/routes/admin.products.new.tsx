import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { ProductCreateWizard } from "../features/store-admin/product-create-wizard.tsx";
import { listMerchantCategories } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/products/new")({
  loader: () => listMerchantCategories(),
  pendingComponent: () => <EmptyState title="Preparando novo produto" description="Carregando categorias e estrutura do cadastro." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível abrir o cadastro" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: NewProductPage,
});

function NewProductPage(): React.JSX.Element {
  const categories = Route.useLoaderData();
  return <><PageHeader title="Adicionar produto" description="Monte o produto inteiro e salve uma única vez no final. Você pode ir e voltar entre as etapas sem perder o que preencheu." /><ProductCreateWizard categories={categories} /></>;
}
