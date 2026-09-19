import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { getMerchantCatalogOverview, getMerchantStorefrontStatus } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/")({
  loader: async () => {
    const [catalog, storefront] = await Promise.all([getMerchantCatalogOverview(), getMerchantStorefrontStatus()]);
    return { catalog, storefront };
  },
  component: StorePage,
});

function StorefrontStatus(props: Readonly<{ store:{storeStatus:string;tenantStatus:string}; domain:{hostname:string;status:string;verifiedAt:string|null;previewUrl:string|null}|null }>):React.JSX.Element {
  const domain=props.domain;
  return <section className="k-card k-store-preview"><div><h2 style={{margin:0}}>Presença pública</h2><p className="k-muted">Visualize o endereço que seus clientes usarão.</p></div><div className="k-store-preview__frame"><span>{domain?.hostname??"Domínio ainda não configurado"}</span><strong>{domain?.previewUrl?"Loja pronta para visualização":"Aguardando domínio ativo"}</strong></div>{domain?.previewUrl?<a className="k-button k-button--primary" href={domain.previewUrl} target="_blank" rel="noreferrer">Abrir loja</a>:<p className="k-status">A prévia pública é liberada quando o domínio store_catalog estiver ativo e verificado.</p>}<div className="k-row__meta">Loja: {props.store.storeStatus} · White Label: {props.store.tenantStatus}{domain?` · domínio ${domain.status}`:""}</div></section>;
}

function StoreLink(props:Readonly<{to:"/admin/store/appearance"|"/admin/store/banners"|"/admin/store/catalog";title:string;description:string}>):React.JSX.Element { return <Link className="k-store-link" to={props.to}><div><strong>{props.title}</strong><span>{props.description}</span></div><b aria-hidden="true">→</b></Link>; }

function StorePage():React.JSX.Element {
  const data=Route.useLoaderData();
  return <div className="k-page"><PageHead title="Minha loja" description="Identidade, aparência, banners, checkout, SEO e presença pública em um único lugar."/><div className="k-store-grid"><section className="k-card"><div><h2 style={{margin:0}}>Configuração da experiência</h2><p className="k-muted">Ajuste apenas dados reais da loja; nenhuma promoção ou conteúdo é inventado.</p></div><div className="k-store-links"><StoreLink to="/admin/store/appearance" title="Identidade e aparência" description={`Layout ${data.catalog.settings.layout}, cores e tipografia.`}/><StoreLink to="/admin/store/banners" title="Banners" description={`${String(data.catalog.banners.length)} banner(s) cadastrado(s).`}/><StoreLink to="/admin/store/catalog" title="Catálogo, checkout e SEO" description={`${String(data.catalog.products.total)} produto(s), busca, categorias, WhatsApp e metadados.`}/></div></section><StorefrontStatus store={data.storefront.store} domain={data.storefront.domain}/></div></div>;
}
