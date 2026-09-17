import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { adminTheme } from "./admin-theme.ts";

const items = [
  { to: "/admin", label: "Início", exact: true },
  { to: "/admin/products", label: "Produtos", exact: false },
  { to: "/admin/categories", label: "Categorias", exact: false },
  { to: "/admin/store", label: "Minha loja", exact: false },
  { to: "/admin/settings", label: "Configurações", exact: false },
] as const;

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <section className="k-admin">
      <style>{adminTheme}</style>
      <div className="k-admin__top">
        <div className="k-admin__brand">
          <span className="k-admin__eyebrow">Administrativo do lojista</span>
          <strong className="k-admin__title">Kataluu Store</strong>
        </div>
      </div>
      <nav className="k-admin__nav" aria-label="Administração da loja">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            activeProps={{ "data-status": "active" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </section>
  );
}

export function PageHead(props: Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <header className="k-page__head">
      <div>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.action}
    </header>
  );
}
