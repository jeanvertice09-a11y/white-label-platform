import type { PublicBrand } from "../../lib/public-site.types.ts";
import { PublicFooter, PublicHeader, publicBrandStyle } from "./public-shell.tsx";

const nav = [
  { href: "#recursos", label: "Recursos" },
  { href: "#identidade", label: "Plataforma" },
  { href: "#como-funciona", label: "Como funciona" },
];

function TenantHero({ brand, loginUrl }: Readonly<{ brand: PublicBrand; loginUrl: string | null }>): React.JSX.Element {
  return (
    <section className="public-hero public-hero--tenant"><div className="public-container public-hero__grid"><div className="public-hero__copy"><span className="public-eyebrow">Plataforma digital</span><h1>Gestão, catálogo e operação em uma experiência com a sua marca.</h1><p>Organize lojistas, planos e domínios enquanto cada loja mantém seu próprio catálogo, produtos, estoque, pedidos e clientes.</p><div className="public-actions">{loginUrl ? <a className="public-button public-button--primary" href={loginUrl}>Acessar plataforma</a> : <a className="public-button public-button--quiet" href="#como-funciona">Conhecer a estrutura</a>}</div></div><TenantPreview brand={brand} /></div></section>
  );
}

function TenantPreview({ brand }: Readonly<{ brand: PublicBrand }>): React.JSX.Element {
  return (
    <div className="public-tenant-preview" id="identidade"><div className="public-tenant-preview__top"><span className="public-dot" /><strong>{brand.name}</strong><span>White Label</span></div><div className="public-tenant-preview__body"><div className="public-tenant-preview__metric"><span>Gestão central</span><strong>Lojistas e planos</strong></div><div className="public-tenant-preview__metric"><span>Operação</span><strong>Domínios e assinaturas</strong></div><div className="public-tenant-preview__metric"><span>Commerce</span><strong>Catálogo e pedidos</strong></div></div></div>
  );
}

function TenantResources(): React.JSX.Element {
  return (
    <section className="public-section" id="recursos"><div className="public-container"><div className="public-section__heading"><span className="public-eyebrow">Estrutura da plataforma</span><h2>Ferramentas para administrar a rede e apoiar a operação das lojas.</h2></div><div className="public-resource-grid"><article><span>01</span><h3>Gestão de lojistas</h3><p>Lojas, planos, assinaturas e domínios organizados no contexto da sua White Label.</p></article><article><span>02</span><h3>Catálogo e operação</h3><p>Produtos, variantes, estoque, pedidos, clientes, cupons e campanhas no ambiente de cada lojista.</p></article><article><span>03</span><h3>Governança</h3><p>Separação de contextos, permissões e auditoria para manter a operação organizada.</p></article></div></div></section>
  );
}

function TenantFlow(): React.JSX.Element {
  return (
    <section className="public-section public-section--soft" id="como-funciona"><div className="public-container public-editorial-grid"><div><span className="public-eyebrow">Como funciona</span><h2>Uma White Label no centro da sua rede.</h2><p>Sua empresa administra a plataforma. Seus lojistas operam suas lojas. Os clientes finais acessam a experiência de cada loja, sem mistura de dados entre contextos.</p></div><div className="public-flow-compact"><span><strong>Sua marca</strong><small>White Label</small></span><i aria-hidden="true">→</i><span><strong>Seus lojistas</strong><small>Lojas</small></span><i aria-hidden="true">→</i><span><strong>Clientes</strong><small>Experiência final</small></span></div></div></section>
  );
}

export function WhiteLabelLanding({ brand, loginUrl }: Readonly<{ brand: PublicBrand; loginUrl: string | null }>): React.JSX.Element {
  return (
    <div className="public-site public-site--tenant" style={publicBrandStyle(brand)}><PublicHeader brand={brand} nav={nav} loginHref={loginUrl} /><main><TenantHero brand={brand} loginUrl={loginUrl} /><TenantResources /><TenantFlow /></main><PublicFooter brand={brand} nav={nav} loginHref={loginUrl}><p>Plataforma de gestão e comércio digital com identidade própria.</p></PublicFooter></div>
  );
}
