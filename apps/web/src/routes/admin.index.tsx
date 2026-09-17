import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/")({
  loader: () => getMerchantCatalogOverview(),
  component: AdminDashboard,
});

function AdminDashboard() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title={data.store.name}
        description="Visão geral do catálogo e da configuração pública da sua loja."
        action={<Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>}
      />
      <div className="k-grid">
        <div className="k-card">
          <div className="k-stat__label">Produtos</div>
          <div className="k-stat__value">{data.products.total}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Categorias</div>
          <div className="k-stat__value">{data.categories.length}</div>
        </div>
        <div className="k-card">
          <div className="k-stat__label">Banners</div>
          <div className="k-stat__value">{data.banners.length}</div>
        </div>
      </div>
      <div className="k-card">
        <h2>Catálogo</h2>
        <p className="k-muted">
          Layout atual: <strong>{data.settings.layout === "modern" ? "Modern" : "Classic"}</strong>.
          Configure aparência, WhatsApp e visibilidade em Minha loja.
        </p>
        <Link className="k-button" to="/admin/store">Configurar minha loja</Link>
      </div>
    </div>
  );
}
