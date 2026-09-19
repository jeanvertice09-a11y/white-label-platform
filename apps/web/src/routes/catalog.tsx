import { createFileRoute } from "@tanstack/react-router";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCatalog } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/catalog")({
  loader: () => getPublicCatalog({ data: { page: 1, pageSize: 12, sort: "position" } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.settings.seoTitle ?? loaderData?.store.name ?? "Catálogo" },
      {
        name: "description",
        content: loaderData?.settings.seoDescription ?? `Catálogo online de ${loaderData?.store.name ?? "loja"}`,
      },
    ],
    links: loaderData?.canonicalUrl ? [{ rel: "canonical", href: loaderData.canonicalUrl }] : [],
  }),
  pendingComponent: () => <CatalogState title="Carregando catálogo…" detail="Buscando produtos e configurações da loja." />,
  errorComponent: CatalogError,
  component: CatalogPage,
});

function CatalogState(props: Readonly<{ title: string; detail: string }>): React.JSX.Element {
  return <main style={{ maxWidth: 720, margin: "60px auto", padding: 24 }}><h1>{props.title}</h1><p>{props.detail}</p></main>;
}

function CatalogError({ error }: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("não encontrado") || message.includes("hostname")) {
    return <CatalogState title="Catálogo não encontrado" detail="Este endereço não corresponde a um catálogo público ativo." />;
  }
  if (message.includes("indisponível") || message.includes("suspens")) {
    return <CatalogState title="Loja indisponível" detail="O catálogo existe, mas não está disponível neste momento." />;
  }
  return <CatalogState title="Não foi possível carregar a loja" detail="Ocorreu um erro interno. Tente novamente mais tarde." />;
}

function CatalogPage() {
  const data = Route.useLoaderData();
  return <StorefrontView data={data} />;
}
