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

function ConfigLink(props: Readonly<{
  to: "/admin/store/appearance" | "/admin/store/banners" | "/admin/store/catalog";
  title: string;
  description: string;
}>): React.JSX.Element {
  return (
    <Link className="k-config-row" to={props.to}>
      <span><strong>{props.title}</strong><small>{props.description}</small></span>
      <b aria-hidden="true">→</b>
    </Link>
  );
}

function StorePreview(props: Readonly<{
  store: { storeStatus: string; tenantStatus: string };
  domain: {
    hostname: string;
    status: string;
    verifiedAt: string | null;
    previewUrl: string | null;
  } | null;
}>): React.JSX.Element {
  const domain = props.domain;
  return (
    <aside className="k-store-configurator__preview">
      <header>
        <span className="k-section-kicker">Prévia pública</span>
        <h2>{domain?.hostname ?? "Domínio ainda não configurado"}</h2>
        <p>Visão contextual da presença pública da loja.</p>
      </header>
      <div className="k-store-browser">
        <div className="k-store-browser__chrome">
          <span /><span /><span />
          <small>{domain?.hostname ?? "sua-loja"}</small>
        </div>
        <div className="k-store-browser__canvas">
          <span className="k-store-browser__label">Sua loja</span>
          <strong>{domain?.previewUrl ? "Storefront disponível" : "Aguardando domínio ativo"}</strong>
          <p>O storefront real da Fase 19 foi preservado; esta é apenas uma referência administrativa.</p>
        </div>
      </div>
      {domain?.previewUrl ? (
        <a className="k-button k-button--primary" href={domain.previewUrl} target="_blank" rel="noreferrer">
          Abrir loja pública
        </a>
      ) : (
        <p className="k-inline-state">
          A prévia pública é liberada quando o domínio store_catalog estiver ativo e verificado.
        </p>
      )}
      <dl className="k-detail-list">
        <div><dt>Loja</dt><dd>{props.store.storeStatus}</dd></div>
        <div><dt>White Label</dt><dd>{props.store.tenantStatus}</dd></div>
        {domain ? <div><dt>Domínio</dt><dd>{domain.status}</dd></div> : null}
      </dl>
    </aside>
  );
}

function StorePage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Minha loja"
        description="Configure a experiência pública e acompanhe o resultado no mesmo espaço."
      />
      <div className="k-store-configurator">
        <main className="k-store-configurator__settings">
          <header className="k-section-head">
            <div>
              <span className="k-section-kicker">Configuração</span>
              <h2>Experiência da loja</h2>
              <p>Identidade, conteúdo e checkout organizados por área.</p>
            </div>
          </header>
          <div className="k-config-list">
            <ConfigLink
              to="/admin/store/appearance"
              title="Identidade e aparência"
              description={`Layout ${data.catalog.settings.layout}, cores e tipografia.`}
            />
            <ConfigLink
              to="/admin/store/banners"
              title="Banners"
              description={`${String(data.catalog.banners.length)} banner(s) cadastrado(s).`}
            />
            <ConfigLink
              to="/admin/store/catalog"
              title="Catálogo, checkout e SEO"
              description={`${String(data.catalog.products.total)} produto(s), busca, categorias, WhatsApp e metadados.`}
            />
          </div>
        </main>
        <StorePreview store={data.storefront.store} domain={data.storefront.domain} />
      </div>
    </div>
  );
}
