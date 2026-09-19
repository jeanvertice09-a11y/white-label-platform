import type { CSSProperties, ReactNode } from "react";
import type { PublicBrand } from "../../lib/public-site.types.ts";

type PublicStyle = CSSProperties & { "--public-accent"?: string };

export function publicBrandStyle(brand: PublicBrand): PublicStyle {
  return { "--public-accent": brand.primaryColor ?? "#17191f" };
}

export function PublicBrandMark({ brand }: Readonly<{ brand: PublicBrand }>): React.JSX.Element {
  return (
    <span className="public-brand">
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="public-brand__logo" /> : <span className="public-brand__glyph" aria-hidden="true">{brand.name.slice(0, 1).toUpperCase()}</span>}
      <strong>{brand.name}</strong>
    </span>
  );
}

export interface PublicNavItem { href: string; label: string }

export function PublicHeader(props: Readonly<{
  brand: PublicBrand;
  nav: PublicNavItem[];
  loginHref: string | null;
}>): React.JSX.Element {
  return (
    <header className="public-header">
      <div className="public-container public-header__inner">
        <a className="public-header__brand-link" href="/" aria-label={`${props.brand.name}, início`}><PublicBrandMark brand={props.brand} /></a>
        <nav className="public-nav" aria-label="Navegação principal">
          {props.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
        </nav>
        <div className="public-header__actions">
          {props.loginHref ? <a className="public-button public-button--quiet" href={props.loginHref}>Acessar</a> : null}
          <details className="public-menu">
            <summary aria-label="Abrir navegação">Menu</summary>
            <div className="public-menu__panel">
              {props.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
              {props.loginHref ? <a href={props.loginHref}>Acessar</a> : null}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter(props: Readonly<{
  brand: PublicBrand;
  nav: PublicNavItem[];
  loginHref: string | null;
  children?: ReactNode;
}>): React.JSX.Element {
  return (
    <footer className="public-footer">
      <div className="public-container public-footer__grid">
        <div><PublicBrandMark brand={props.brand} />{props.children ? <div className="public-footer__copy">{props.children}</div> : null}</div>
        <nav aria-label="Navegação do rodapé">{props.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="public-footer__access">{props.loginHref ? <a href={props.loginHref}>Acessar plataforma</a> : <span>Acesso disponível após configuração do domínio.</span>}</div>
      </div>
    </footer>
  );
}
