import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
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
  { label: "Principal", items: [{ to: "/admin", label: "Resumo da loja", exact: true, icon: "home" }] },
  { label: "Vendas", items: [{ to: "/admin/orders", label: "Pedidos e vendas", exact: false, icon: "orders" }, { to: "/admin/customers", label: "Meus clientes", exact: false, icon: "customers" }] },
  { label: "Produtos", items: [{ to: "/admin/products", label: "Meus produtos", exact: false, icon: "products" }, { to: "/admin/categories", label: "Categorias", exact: false, icon: "categories" }, { to: "/admin/inventory", label: "Controle de estoque", exact: false, icon: "inventory" }] },
  { label: "Divulgação", items: [{ to: "/admin/coupons", label: "Cupons de desconto", exact: true, icon: "marketing" }, { to: "/admin/campaigns", label: "Campanhas", exact: true, icon: "activity" }] },
  { label: "Financeiro", items: [{ to: "/admin/finance", label: "Entradas e resultados", exact: true, icon: "revenue" }, { to: "/admin/purchases", label: "Compras e despesas", exact: true, icon: "orders" }, { to: "/admin/suppliers", label: "Fornecedores", exact: true, icon: "store" }] },
  { label: "Gestão", items: [{ to: "/admin/tasks", label: "Tarefas", exact: true, icon: "check" }, { to: "/admin/operations", label: "Relatórios e histórico", exact: true, icon: "activity" }] },
  { label: "Loja online", items: [{ to: "/admin/store", label: "Dados da loja", exact: true, icon: "store" }, { to: "/admin/store/appearance", label: "Visual da loja", exact: true, icon: "palette" }, { to: "/admin/store/banners", label: "Banners da loja", exact: true, icon: "marketing" }, { to: "/admin/store/catalog", label: "Catálogo e formas de venda", exact: true, icon: "settings" }] },
  { label: "Conta", items: [{ to: "/admin/settings", label: "Plano e configurações", exact: true, icon: "settings" }] },
];

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function AdminSidebar(props: Readonly<{ open: boolean; onClose: () => void }>): React.JSX.Element {
  return (
    <>
      <button type="button" className={props.open ? "k-admin__overlay is-open" : "k-admin__overlay"} onClick={props.onClose} aria-label="Fechar menu" tabIndex={props.open ? 0 : -1} />
      <aside id="merchant-navigation" className={props.open ? "k-admin__sidebar is-open" : "k-admin__sidebar"} aria-label="Navegação da loja">
        <div className="k-admin__brand"><span className="k-admin__brand-mark" aria-hidden="true">K</span><div className="k-admin__brand-copy"><strong>Kataluu</strong><small>Painel da loja</small></div></div>
        <nav className="k-admin__nav" aria-label="Administração da loja">
          {navigation.map((group) => (
            <div className="k-admin__nav-group" key={group.label}>
              <span className="k-admin__nav-label">{group.label}</span>
              {group.items.map((item) => (
                <Link key={item.to} to={item.to} activeOptions={{ exact: item.exact }} activeProps={{ "data-status": "active" }} onClick={props.onClose}>
                  <DashboardIcon name={item.icon} /><span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="k-admin__sidebar-foot"><a className="k-admin__store-link" href="/" target="_blank" rel="noreferrer">Ver minha loja online ↗</a><div className="k-admin__account"><span className="k-admin__avatar" aria-hidden="true">L</span><div><strong>Minha conta</strong><small>Administração da loja</small></div></div></div>
      </aside>
    </>
  );
}

function MobileNavigation({ open, onMenu }: Readonly<{ open: boolean; onMenu: () => void }>): React.JSX.Element {
  return (
    <nav className="k-admin__mobile-nav" aria-label="Atalhos do painel">
      <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ "data-status": "active" }}><DashboardIcon name="home" /><span>Início</span></Link>
      <Link to="/admin/orders" activeOptions={{ exact: false }} activeProps={{ "data-status": "active" }}><DashboardIcon name="orders" /><span>Pedidos</span></Link>
      <Link to="/admin/products" activeOptions={{ exact: false }} activeProps={{ "data-status": "active" }}><DashboardIcon name="products" /><span>Produtos</span></Link>
      <Link to="/admin/store" activeOptions={{ exact: false }} activeProps={{ "data-status": "active" }}><DashboardIcon name="store" /><span>Loja</span></Link>
      <button type="button" onClick={onMenu} aria-controls="merchant-navigation" aria-expanded={open}><DashboardIcon name="menu" /><span>Menu</span></button>
    </nav>
  );
}

export function AdminShell({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  function openMenu(): void {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMobileOpen(true);
  }
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    const drawer = document.getElementById("merchant-navigation");
    const firstFocusable=drawer?.querySelector<HTMLElement>(FOCUSABLE);if(firstFocusable)firstFocusable.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false); return; }
      if (event.key !== "Tab" || !drawer) return;
      const items = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); if(last)last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); if(openerRef.current)openerRef.current.focus(); };
  }, [mobileOpen]);
  return (
    <section className="k-admin">
      <a className="k-skip" href="#merchant-content">Ir para o conteúdo</a>
      <AdminSidebar open={mobileOpen} onClose={() => { setMobileOpen(false); }} />
      <div className="k-admin__main">
        <div className="k-admin__mobilebar">
          <button className="k-admin__menu" type="button" onClick={openMenu} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="merchant-navigation"><DashboardIcon name="menu" /></button>
          <strong>Minha loja</strong><Link to="/admin/store">Configurar</Link>
        </div>
        <main className="k-admin__content" id="merchant-content">{children}</main>
      </div>
      <MobileNavigation open={mobileOpen} onMenu={openMenu} />
    </section>
  );
}

export function PageHead(props: Readonly<{ title: string; description: string; action?: ReactNode }>): React.JSX.Element {
  return <header className="k-page__head"><div className="k-page__head-copy"><span className="k-section-kicker">Minha loja / {props.title}</span><h1>{props.title}</h1><p>{props.description}</p></div>{props.action ? <div className="k-page__head-action">{props.action}</div> : null}</header>;
}
