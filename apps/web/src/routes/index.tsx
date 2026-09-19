import { createFileRoute, redirect } from "@tanstack/react-router";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCatalog } from "../lib/server/catalog.functions.ts";
import { getRootResolution } from "../lib/server/routing.functions.ts";

export const Route = createFileRoute("/")({
  loader: async () => {
    const resolution = await getRootResolution();
    if (resolution.target !== null) {
      // TanStack Router redirects are intentionally thrown control-flow objects.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: resolution.target });
    }
    if (!resolution.storefront) return { kind: "landing" as const, catalog: null };
    const catalog = await getPublicCatalog({ data: { page: 1, pageSize: 12, sort: "position" } });
    return { kind: "storefront" as const, catalog };
  },
  head: ({ loaderData }) => {
    if (loaderData?.kind !== "storefront" || !loaderData.catalog) return { meta: [{ title: "Kataluu" }] };
    const data = loaderData.catalog;
    return {
      meta: [
        { title: data.settings.seoTitle ?? data.store.name },
        {
          name: "description",
          content: data.settings.seoDescription ?? `Loja online de ${data.store.name}`,
        },
      ],
      links: [{ rel: "canonical", href: data.canonicalUrl }],
    };
  },
  pendingComponent: RootLoading,
  errorComponent: RootError,
  component: RootPage,
});

function RootLoading(): React.JSX.Element {
  return <main className="sf-state"><div className="sf-state__skeleton" /><div className="sf-state__skeleton sf-state__skeleton--short" /></main>;
}

function RootError(): React.JSX.Element {
  return <main className="sf-state"><h1>Não foi possível carregar esta página</h1><p>Tente novamente em alguns instantes.</p></main>;
}

function RootPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  if (data.kind === "storefront" && data.catalog) return <StorefrontView data={data.catalog} />;
  return <InstitutionalHome />;
}

function InstitutionalHome(): React.JSX.Element {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 32,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: "#f7f8fa",
      color: "#111318",
    }}>
      <section style={{ maxWidth: 720, textAlign: "center" }}>
        <strong style={{ fontSize: 14, letterSpacing: ".08em", textTransform: "uppercase" }}>Kataluu</strong>
        <h1 style={{ fontSize: "clamp(36px, 7vw, 64px)", margin: "18px 0 14px", letterSpacing: "-.05em" }}>
          Sua operação digital em uma única plataforma.
        </h1>
        <p style={{ color: "#69707d", lineHeight: 1.6, fontSize: 17 }}>
          Gestão, catálogo, vendas e operação para plataformas White Label e seus lojistas.
        </p>
      </section>
    </main>
  );
}
