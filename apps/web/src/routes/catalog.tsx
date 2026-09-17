import { createFileRoute } from "@tanstack/react-router";
import { getPublicCatalogData } from "../lib/server/catalog.functions.ts";
import { PublicCatalogPage } from "../features/catalog/public-catalog-page.tsx";
import "../features/catalog/catalog.css";

export const Route = createFileRoute("/catalog")({
  loader: () =>
    getPublicCatalogData({
      data: { page: 1, pageSize: 24, sort: "newest" },
    }),
  errorComponent: CatalogError,
  component: CatalogRoute,
});

function CatalogRoute(): React.JSX.Element {
  const initial = Route.useLoaderData();
  return <PublicCatalogPage initial={initial} />;
}

function CatalogError(): React.JSX.Element {
  return (
    <section className="catalog-error" role="alert">
      <strong>Catálogo não encontrado</strong>
      <p>Este endereço não está vinculado a um catálogo público ativo.</p>
    </section>
  );
}
