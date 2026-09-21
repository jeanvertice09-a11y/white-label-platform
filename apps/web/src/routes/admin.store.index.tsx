import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { statusLabel } from "../lib/ui-labels.ts";
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
        <span className="k-section-kicker">Loja pública</span>
        <h2>{domain?.hostname ?? "Domínio ainda não configurado"}</h2>
        <p>Confira a situação atual da presença pública da sua loja.</p>
      </header>
      <div className="k-store-browser">
        <div className="k-store-browser__chrome">
          <span /><span /><span />
          <small>{domain?.hostname ?? "sua-loja"}</small>
        </div>
        <div className="k-store-browser__canvas">
          <span className="k-store-browser__label">Sua loja</span>
          <strong>{domain?.previewUrl ? "Loja pública disponível" : "Aguardando domínio ativo"}</strong>
          <p>Esta prévia administrativa mostra apenas a disponibilidade da loja pública.</p>
        </div>
      </div>
      {domain?.previewUrl ? (
        <a className="k-button k-button--primary" href={domain.previewUrl} target="_blank" rel="noreferrer">
          Abrir loja pública
        </a>
      ) : (
        <p className="k-inline-state">
          A loja pública fica disponível quando o domínio do catálogo estiver ativo e verificado.
        </p>
      )}
      <dl className="k-detail-list">
        <div><dt>Loja</dt><dd>{statusLabel(props.store.storeStatus)}</dd></div>
        <div><dt>White Label</dt><dd>{statusLabel(props.store.tenantStatus)}</dd></div>
        {domain ? <div><dt>Domínio</dt><dd>{statusLabel(domain.status)}</dd></div> : null}
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
        description="Configure a experiência pública e acompanhe a disponibilidade da sua loja."
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
              title="Aparência"
              description={`Layout ${data.catalog.settings.layout === "modern" ? "Moderno" : "Clássico"}, cores e tipografia.`}
            />
            <ConfigLink
              to="/admin/store/banners"
              title="Banners"
              description={`${String(data.catalog.banners.length)} banner(s) cadastrado(s).`}
            />
            <ConfigLink
              to="/admin/store/catalog"
              title="Catálogo e checkout"
              description={`${String(data.catalog.products.total)} produto(s), busca, categorias, WhatsApp e informações para buscadores.`}
            />
          </div>
        </main>
        <StorePreview store={data.storefront.store} domain={data.storefront.domain} />
      </div>
    </div>
  );
}
