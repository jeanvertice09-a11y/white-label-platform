import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardIcon, type DashboardIconName } from "../../components/dashboard/DashboardIcon.tsx";
import "../../styles/panel-navigation-lot1.css";

interface NavItem {
  to: string;
  label: string;
  exact: boolean;
  icon: DashboardIconName;
}

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

const navigation: readonly NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/admin", label: "Início", exact: true, icon: "home" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { to: "/admin/orders", label: "Pedidos", exact: false, icon: "orders" },
      { to: "/admin/customers", label: "Clientes", exact: false, icon: "customers" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { to: "/admin/products", label: "Produtos", exact: false, icon: "products" },
      { to: "/admin/categories", label: "Categorias", exact: false, icon: "categories" },
      { to: "/admin/inventory", label: "Estoque", exact: false, icon: "inventory" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/admin/coupons", label: "Cupons", exact: true, icon: "marketing" },
      { to: "/admin/campaigns", label: "Campanhas", exact: true, icon: "activity" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/admin/finance", label: "Visão financeira", exact: true, icon: "revenue" },
      { to: "/admin/purchases", label: "Compras", exact: true, icon: "orders" },
      { to: "/admin/suppliers", label: "Fornecedores", exact: true, icon: "store" },
    ],
  },
  {
    label: "Organização",
    items: [
      { to: "/admin/tasks", label: "Tarefas", exact: true, icon: "check" },
    ],
  },
  {
    label: "Minha loja",
    items: [
      { to: "/admin/store", label: "Informações da loja", exact: true, icon: "store" },
      { to: "/admin/store/appearance", label: "Aparência", exact: true, icon: "palette" },
      { to: "/admin/store/banners", label: "Banners", exact: true, icon: "marketing" },
      { to: "/admin/store/catalog", label: "Catálogo e checkout", exact: true, icon: "settings" },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/admin/settings", label: "Configurações", exact: true, icon: "settings" },
    ],
  },
];

function AdminSidebar(props: Readonly<{ open: boolean; onClose: () => void }>): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        className={props.open ? "k-admin__overlay is-open" : "k-admin__overlay"}
        onClick={props.onClose}
        aria-label="Fechar menu"
      />
      <aside className={props.open ? "k-admin__sidebar is-open" : "k-admin__sidebar"} aria-label="Navegação da loja">
        <div className="k-admin__brand">
          <span className="k-admin__brand-mark" aria-hidden="true">K</span>
          <div className="k-admin__brand-copy">
            <strong>Kataluu</strong>
            <small>Painel da loja</small>
          </div>
        </div>

        <nav className="k-admin__nav" aria-label="Administração da loja">
          {navigation.map((group) => (
            <div className="k-admin__nav-group" key={group.label}>
              <span className="k-admin__nav-label">{group.label}</span>
              {group.items.map((item) => (
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
            </div>
          ))}
        </nav>

        <div className="k-admin__sidebar-foot">
          <div className="k-admin__account">
            <span className="k-admin__avatar" aria-hidden="true">L</span>
            <div><strong>Conta da loja</strong><small>Operação do lojista</small></div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function AdminShell({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <section className="k-admin">
      <a className="k-skip" href="#merchant-content">Ir para o conteúdo</a>
      <AdminSidebar open={mobileOpen} onClose={() => { setMobileOpen(false); }} />
      <div className="k-admin__main">
        <div className="k-admin__mobilebar">
          <button className="k-admin__menu" type="button" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu">
            <DashboardIcon name="menu" />
          </button>
          <strong>Painel da loja</strong>
          <Link to="/admin/store">Minha loja</Link>
        </div>
        <main className="k-admin__content" id="merchant-content">{children}</main>
      </div>
    </section>
  );
}

export function PageHead(props: Readonly<{ title: string; description: string; action?: ReactNode }>): React.JSX.Element {
  return (
    <header className="k-page__head">
      <div className="k-page__head-copy">
        <span className="k-section-kicker">Painel da loja / {props.title}</span>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.action ? <div className="k-page__head-action">{props.action}</div> : null}
    </header>
  );
}
