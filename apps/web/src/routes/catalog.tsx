import { createFileRoute, redirect } from "@tanstack/react-router";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCatalog } from "../lib/server/catalog.functions.ts";
import { getRootResolution } from "../lib/server/routing.functions.ts";

export const Route = createFileRoute("/catalog")({
  beforeLoad: async () => {
    const resolution = await getRootResolution();
    if (resolution.storefront) {
      // Compatibilidade com bookmarks antigos: store_catalog possui uma única home pública em /.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/", replace: true });
    }
  },
  loader: () => getPublicCatalog({ data: { page: 1, pageSize: 12, sort: "position" } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.settings.seoTitle ?? loaderData?.store.name ?? "Catálogo" },
      {
        name: "description",
        content: loaderData?.settings.seoDescription ?? `Loja online de ${loaderData?.store.name ?? "loja"}`,
      },
    ],
    links: loaderData?.canonicalUrl ? [{ rel: "canonical", href: loaderData.canonicalUrl }] : [],
  }),
  pendingComponent: () => <CatalogState title="Carregando loja…" detail="Buscando produtos e configurações." />,
  errorComponent: CatalogError,
  component: CatalogPage,
});

function CatalogState(props: Readonly<{ title: string; detail: string }>): React.JSX.Element {
  return <main className="sf-state"><h1>{props.title}</h1><p>{props.detail}</p></main>;
}

function CatalogError({ error }: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("não encontrado") || message.includes("hostname")) {
    return <CatalogState title="Loja não encontrada" detail="Este endereço não corresponde a uma loja pública ativa." />;
  }
  if (message.includes("indisponível") || message.includes("suspens")) {
    return <CatalogState title="Loja indisponível" detail="A loja existe, mas não está disponível neste momento." />;
  }
  return <CatalogState title="Não foi possível carregar a loja" detail="Ocorreu um erro interno. Tente novamente mais tarde." />;
}

function CatalogPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <StorefrontView data={data} />;
}
