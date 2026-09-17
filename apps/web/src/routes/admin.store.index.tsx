import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/")({
  loader: () => getMerchantCatalogOverview(),
  component: StorePage,
});

function StorePage() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Minha loja"
        description="Aparência, banners e regras do catálogo público."
      />
      <div className="k-grid">
        <div className="k-card">
          <h2>Aparência</h2>
          <p className="k-muted">Layout {data.settings.layout}, cores e identidade visual.</p>
          <Link className="k-button" to="/admin/store/appearance">Editar aparência</Link>
        </div>
        <div className="k-card">
          <h2>Banners</h2>
          <p className="k-muted">{data.banners.length} banner(s) cadastrado(s).</p>
          <Link className="k-button" to="/admin/store/banners">Gerenciar banners</Link>
        </div>
        <div className="k-card">
          <h2>Catálogo</h2>
          <p className="k-muted">Busca, categorias, preços, WhatsApp e SEO.</p>
          <Link className="k-button" to="/admin/store/catalog">Configurar catálogo</Link>
        </div>
      </div>
    </div>
  );
}
