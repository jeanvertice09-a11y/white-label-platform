import type { PublicBrand } from "../../lib/public-site.types.ts";
import { PublicFooter, PublicHeader, publicBrandStyle } from "./public-shell.tsx";

const brand: PublicBrand = { name: "Kataluu", logoUrl: null, primaryColor: "#17191f" };
const accessHref = "https://app.kataluu.com.br/login";
const nav = [
  { href: "#produto", label: "Produto" },
  { href: "#recursos", label: "Recursos" },
  { href: "#white-label", label: "White Label" },
  { href: "#como-funciona", label: "Como funciona" },
];

function Hero(): React.JSX.Element {
  return (
    <section className="public-hero" id="produto">
      <div className="public-container public-hero__grid">
        <div className="public-hero__copy">
          <span className="public-eyebrow">Infraestrutura White Label</span>
          <h1>Sua plataforma. Sua marca. Seus lojistas.</h1>
          <p>A Kataluu reúne a infraestrutura para sua empresa oferecer catálogo e operação de comércio digital com identidade própria, gestão centralizada e separação segura entre cada cliente.</p>
          <div className="public-actions"><a className="public-button public-button--primary" href="#como-funciona">Entender como funciona</a><a className="public-button public-button--quiet" href={accessHref}>Acessar</a></div>
        </div>
        <ProductStage />
      </div>
    </section>
  );
}

function ProductStage(): React.JSX.Element {
  return (
    <div className="public-product-stage" aria-label="Representação da operação White Label">
      <div className="public-product-stage__top"><span className="public-dot" /><span>Kataluu / operação central</span><span className="public-pill">White Label</span></div>
      <div className="public-product-stage__body">
        <aside><strong>Visão geral</strong><span>White Labels</span><span>Faturamento</span><span>Domínios</span><span>Auditoria</span></aside>
        <div className="public-product-stage__canvas">
          <p>Estrutura da operação</p><strong>Uma base para múltiplas marcas</strong>
          <div className="public-layer-stack"><span>Kataluu</span><span>Sua White Label</span><span>Seus lojistas</span><span>Clientes finais</span></div>
        </div>
      </div>
    </div>
  );
}

function WhiteLabelSection(): React.JSX.Element {
  return (
    <section className="public-section public-section--contrast" id="white-label">
      <div className="public-container public-editorial-grid">
        <div><span className="public-eyebrow">White Label de verdade</span><h2>A operação é sua. A experiência também.</h2><p>Nome, marca, cor principal e domínios fazem a plataforma assumir a identidade de cada empresa sem misturar contextos entre White Labels e lojas.</p></div>
        <div className="public-brand-demo" aria-label="Exemplo visual de personalização">
          <div className="public-brand-demo__bar"><span className="public-brand-demo__logo">S</span><strong>Sua marca</strong><span>painel.suamarca.com.br</span></div>
          <div className="public-brand-demo__screen"><span>Gestão de lojistas</span><h3>Uma plataforma que parece sua porque opera como sua.</h3><div className="public-brand-demo__line" /><div className="public-brand-demo__line public-brand-demo__line--short" /></div>
        </div>
      </div>
    </section>
  );
}

const resourceGroups = [
  { title: "Gestão", text: "Lojistas, lojas, planos, assinaturas, faturamento e domínios em um contexto central." },
  { title: "Commerce", text: "Catálogo, produtos, variantes, estoque, pedidos, clientes, cupons e campanhas para a operação do lojista." },
  { title: "Operação", text: "Dashboards, auditoria, billing e isolamento multi-tenant para administrar a plataforma com rastreabilidade." },
];

function Resources(): React.JSX.Element {
  return (
    <section className="public-section" id="recursos"><div className="public-container"><div className="public-section__heading"><span className="public-eyebrow">Recursos existentes</span><h2>Da gestão da White Label à rotina do lojista.</h2><p>Uma cadeia conectada, com responsabilidades separadas e ferramentas próprias para cada nível.</p></div><div className="public-resource-grid">{resourceGroups.map((group, index) => <article key={group.title}><span>0{String(index + 1)}</span><h3>{group.title}</h3><p>{group.text}</p></article>)}</div></div></section>
  );
}

const steps = [
  ["Kataluu", "Infraestrutura e governança da plataforma."],
  ["Sua White Label", "Sua identidade, domínios, planos e gestão."],
  ["Seus lojistas", "Cada loja com operação e contexto próprios."],
  ["Clientes dos lojistas", "A experiência final de catálogo e compra."],
] as const;

function HowItWorks(): React.JSX.Element {
  return (
    <section className="public-section public-section--soft" id="como-funciona"><div className="public-container"><div className="public-section__heading"><span className="public-eyebrow">Como funciona</span><h2>Uma estrutura em quatro níveis, sem confundir papéis.</h2></div><ol className="public-flow">{steps.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol></div></section>
  );
}

function Closing(): React.JSX.Element {
  return (
    <section className="public-closing"><div className="public-container public-closing__inner"><div><span className="public-eyebrow">Infraestrutura para crescer com organização</span><h2>Construa sua operação White Label sobre uma base que já separa plataforma, empresa e loja.</h2></div><div className="public-actions"><a className="public-button public-button--primary" href="#recursos">Explorar recursos</a><a className="public-button public-button--quiet" href={accessHref}>Entrar</a></div></div></section>
  );
}

export function KataluuLanding(): React.JSX.Element {
  return (
    <div className="public-site" style={publicBrandStyle(brand)}><PublicHeader brand={brand} nav={nav} loginHref={accessHref} /><main><Hero /><WhiteLabelSection /><Resources /><HowItWorks /><Closing /></main><PublicFooter brand={brand} nav={nav} loginHref={accessHref}><p>Infraestrutura White Label para empresas operarem sua própria plataforma de catálogo e comércio.</p></PublicFooter></div>
  );
}
