import { createFileRoute } from "@tanstack/react-router";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCategoryPage } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/categoria/$slug" as never)({
  loader: ({ params }) => getPublicCategoryPage({ data: { slug: (params as { slug: string }).slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.category.name} · ${loaderData.store.name}` : "Categoria" },
      { name: "description", content: loaderData?.category.description ?? `Produtos de ${loaderData?.category.name ?? "categoria"}` },
    ],
    links: loaderData?.canonicalUrl ? [{ rel: "canonical", href: loaderData.canonicalUrl }] : [],
  }),
  pendingComponent: () => <main className="sf-state"><div className="sf-state__skeleton" /><div className="sf-state__skeleton sf-state__skeleton--short" /></main>,
  errorComponent: () => <main className="sf-state"><h1>Categoria não encontrada</h1><p>Esta categoria não está disponível nesta loja.</p><a href="/">Voltar para a loja</a></main>,
  component: CategoryPage,
});

function CategoryPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <StorefrontView data={data} initialCategoryId={data.category.id} pageTitle={data.category.name} />;
}
