import { createFileRoute } from "@tanstack/react-router";
import { StorefrontView } from "../features/storefront/storefront-view.tsx";
import { getPublicCatalog } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/catalog")({
  loader: () => getPublicCatalog({
    data: {
      page: 1,
      pageSize: 48,
      sort: "position",
    },
  }),
  errorComponent: CatalogError,
  component: CatalogPage,
});

function CatalogError(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = props.error instanceof Error
    ? props.error.message
    : "Catálogo indisponível";
  return (
    <section style={{ padding: 32, textAlign: "center" }}>
      <h1>Catálogo indisponível</h1>
      <p>{message}</p>
    </section>
  );
}

function CatalogPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <StorefrontView data={data} />;
}
