import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  DashboardIcon,
  type DashboardIconName,
} from "../../components/dashboard/DashboardIcon.tsx";

interface NavItem {
  to: string;
  label: string;
  exact: boolean;
  icon: DashboardIconName;
}

const items: readonly NavItem[] = [
  { to: "/admin", label: "Visão geral", exact: true, icon: "home" },
  { to: "/admin/products", label: "Produtos", exact: false, icon: "products" },
  { to: "/admin/categories", label: "Categorias", exact: false, icon: "categories" },
  { to: "/admin/orders", label: "Pedidos", exact: false, icon: "orders" },
  { to: "/admin/customers", label: "Clientes", exact: false, icon: "customers" },
  { to: "/admin/inventory", label: "Estoque", exact: false, icon: "inventory" },
  { to: "/admin/marketing", label: "Marketing", exact: false, icon: "marketing" },
  { to: "/admin/store", label: "Minha loja", exact: false, icon: "store" },
  { to: "/admin/settings", label: "Configurações", exact: false, icon: "settings" },
];

function AdminSidebar(props: Readonly<{ open: boolean; onClose: () => void }>) {
  return (
    <>
      <button
        type="button"
        className={props.open ? "k-admin__overlay is-open" : "k-admin__overlay"}
        onClick={props.onClose}
        aria-label="Fechar menu"
      />
      <aside className={props.open ? "k-admin__sidebar is-open" : "k-admin__sidebar"}>
        <div className="k-admin__brand">
          <span className="k-admin__brand-mark" aria-hidden="true">K</span>
          <div className="k-admin__brand-copy">
            <strong>Kataluu Store</strong>
            <small>Administração da loja</small>
          </div>
        </div>
        <nav className="k-admin__nav" aria-label="Administração da loja">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ "data-status": "active" }}
              onClick={props.onClose}
            >
              <DashboardIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="k-admin__sidebar-foot">
          Painel do lojista
          <strong>Operação da loja</strong>
        </div>
      </aside>
    </>
  );
}

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <section className="k-admin">
      <AdminSidebar open={mobileOpen} onClose={() => { setMobileOpen(false); }} />
      <div className="k-admin__main">
        <header className="k-admin__header">
          <button className="k-admin__menu" type="button" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu">
            <DashboardIcon name="menu" />
          </button>
          <div className="k-admin__header-title">
            <span className="k-admin__eyebrow">Administrativo</span>
            <strong className="k-admin__title">Gestão da loja</strong>
          </div>
          <div className="k-admin__header-actions">
            <div className="k-admin__user">
              <span className="k-admin__avatar" aria-hidden="true">K</span>
              <span>Minha loja</span>
            </div>
          </div>
        </header>
        <main className="k-admin__content">{children}</main>
      </div>
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
