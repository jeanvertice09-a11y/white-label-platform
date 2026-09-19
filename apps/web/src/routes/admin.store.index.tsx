import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import {
  getMerchantCatalogOverview,
  getMerchantStorefrontStatus,
} from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/")({
  loader: async () => {
    const [catalog, storefront] = await Promise.all([
      getMerchantCatalogOverview(),
      getMerchantStorefrontStatus(),
    ]);
    return { catalog, storefront };
  },
  component: StorePage,
});

function StorefrontStatus(props: Readonly<{
  store: { storeStatus: string; tenantStatus: string };
  domain: { hostname: string; status: string; verifiedAt: string | null; previewUrl: string | null } | null;
}>): React.JSX.Element {
  const domain = props.domain;
  return <div className="k-card">
    <h2>Loja pública</h2>
    <p className="k-muted">Loja: {props.store.storeStatus} · White Label: {props.store.tenantStatus}</p>
    {domain ? <><p className="k-muted">Domínio: {domain.hostname} · {domain.status}{domain.verifiedAt ? " · verificado" : " · aguardando verificação"}</p>{domain.previewUrl ? <a className="k-button k-button--primary" href={domain.previewUrl} target="_blank" rel="noreferrer">Visualizar catálogo</a> : <p className="k-status">A prévia pública fica disponível quando o domínio do catálogo estiver ativo e verificado.</p>}</> : <p className="k-status">Nenhum domínio de catálogo está configurado para esta loja.</p>}
  </div>;
}

function StorePage() {
  const data = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Minha loja" description="Aparência, banners, checkout e estado do catálogo público." />
    <div className="k-grid">
      <StorefrontStatus store={data.storefront.store} domain={data.storefront.domain} />
      <div className="k-card"><h2>Aparência</h2><p className="k-muted">Layout {data.catalog.settings.layout}, cores e identidade visual.</p><Link className="k-button" to="/admin/store/appearance">Editar aparência</Link></div>
      <div className="k-card"><h2>Banners</h2><p className="k-muted">{data.catalog.banners.length} banner(s) cadastrado(s).</p><Link className="k-button" to="/admin/store/banners">Gerenciar banners</Link></div>
      <div className="k-card"><h2>Catálogo e checkout</h2><p className="k-muted">{data.catalog.products.total} produto(s) · modo {data.catalog.settings.checkoutMode}.</p><p className="k-muted">Busca, categorias, preços, WhatsApp e SEO.</p><Link className="k-button" to="/admin/store/catalog">Configurar catálogo</Link></div>
    </div>
  </div>;
}
