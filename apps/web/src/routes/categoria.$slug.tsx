import { createFileRoute } from "@tanstack/react-router";
import type { CatalogPage, CatalogSettings, Category, StoreBanner, StorefrontStore } from "@white-label/catalog";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCategoryPage } from "../lib/server/catalog.functions.ts";

interface CategoryPageData {
  store: StorefrontStore;
  settings: CatalogSettings;
  categories: Category[];
  banners: StoreBanner[];
  products: CatalogPage;
  category: Category;
  canonicalUrl: string;
}

// @ts-expect-error -- TanStack gera o tipo desta nova rota durante o build.
export const Route = createFileRoute("/categoria/$slug")({
  loader: ({ params }) => getPublicCategoryPage({ data: { slug: (params as unknown as { slug: string }).slug } }),
  head: ({ loaderData }) => {
    const data = loaderData as unknown as CategoryPageData | undefined;
    const title = data ? `${data.category.name} · ${data.store.name}` : "Categoria";
    const description = data?.category.description ?? data?.settings.seoDescription ?? `Produtos de ${data?.category.name ?? "categoria"}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        ...(data?.canonicalUrl ? [{ property: "og:url", content: data.canonicalUrl }] : []),
      ],
      links: data?.canonicalUrl ? [{ rel: "canonical", href: data.canonicalUrl }] : [],
    };
  },
  pendingComponent: () => <main className="sf-state"><div className="sf-state__skeleton" /><div className="sf-state__skeleton sf-state__skeleton--short" /></main>,
  errorComponent: () => <main className="sf-state"><h1>Categoria não encontrada</h1><p>Esta categoria não está disponível nesta loja.</p><a href="/">Voltar para a loja</a></main>,
  component: CategoryPage,
});

function CategoryPage(): React.JSX.Element {
  const data = Route.useLoaderData() as unknown as CategoryPageData;
  return <StorefrontView data={data} initialCategoryId={data.category.id} pageTitle={data.category.name} />;
}
