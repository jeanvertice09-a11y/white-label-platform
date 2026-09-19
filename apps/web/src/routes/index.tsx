import { createFileRoute, redirect } from "@tanstack/react-router";
import { KataluuLanding } from "../features/public/kataluu-landing.tsx";
import { PublicDomainStateView } from "../features/public/public-domain-state.tsx";
import { WhiteLabelLanding } from "../features/public/white-label-landing.tsx";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCatalog } from "../lib/server/catalog.functions.ts";
import { getPublicSiteExperience } from "../lib/server/public-site.functions.ts";
import { getRootResolution } from "../lib/server/routing.functions.ts";
import "../styles/public.css";

export const Route = createFileRoute("/")({
  loader: async () => {
    const resolution = await getRootResolution();
    if (resolution.target !== null) {
      // TanStack Router redirects are intentionally thrown control-flow objects.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: resolution.target });
    }
    if (resolution.storefront) {
      const catalog = await getPublicCatalog({ data: { page: 1, pageSize: 24, search: "" } });
      return { kind: "storefront" as const, catalog };
    }
    return { kind: "public" as const, site: await getPublicSiteExperience() };
  },
  head: ({ loaderData }) => {
    if (loaderData?.kind === "storefront") {
      return { meta: [{ title: `${loaderData.catalog.store.name} | Catálogo` }, { name: "description", content: `Catálogo online de ${loaderData.catalog.store.name}.` }] };
    }
    const site = loaderData?.kind === "public" ? loaderData.site : null;
    if (site?.kind === "white_label") {
      const description = `Plataforma digital de ${site.brand.name} para gestão de lojistas, catálogo e operação.`;
      return {
        meta: [{ title: site.brand.name }, { name: "description", content: description }, { property: "og:title", content: site.brand.name }, { property: "og:description", content: description }, { property: "og:type", content: "website" }],
        links: site.canonicalUrl ? [{ rel: "canonical", href: site.canonicalUrl }] : [],
      };
    }
    if (site?.kind === "state") {
      return { meta: [{ title: "Endereço indisponível" }, { name: "robots", content: "noindex,nofollow" }] };
    }
    const description = "Infraestrutura White Label para empresas oferecerem sua própria plataforma de catálogo e comércio digital.";
    return {
      meta: [{ title: "Kataluu | Infraestrutura White Label" }, { name: "description", content: description }, { property: "og:title", content: "Kataluu | Infraestrutura White Label" }, { property: "og:description", content: description }, { property: "og:type", content: "website" }],
      links: site?.kind === "kataluu" && site.canonicalUrl ? [{ rel: "canonical", href: site.canonicalUrl }] : [],
    };
  },
  pendingComponent: RootLoading,
  errorComponent: RootError,
  component: RootPage,
});

function RootLoading(): React.JSX.Element {
  return <main className="public-state"><section><span className="public-eyebrow">Carregando</span><h1>Preparando a experiência.</h1></section></main>;
}

function RootError(): React.JSX.Element {
  return <main className="public-state"><section><span className="public-eyebrow">Indisponível</span><h1>Não foi possível abrir esta página.</h1><p>Tente novamente em alguns instantes.</p></section></main>;
}

function RootPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  if (data.kind === "storefront") return <StorefrontView data={data.catalog} />;
  if (data.site.kind === "white_label") return <WhiteLabelLanding brand={data.site.brand} loginUrl={data.site.loginUrl} />;
  if (data.site.kind === "state") return <PublicDomainStateView state={data.site.state} />;
  return <KataluuLanding />;
}
