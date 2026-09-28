import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DashboardIcon } from "../../components/dashboard/DashboardIcon.tsx";
import styles from "./AdminShell.module.css";

type IconName =
  | "home" | "orders" | "products" | "inventory" | "customers" | "categories"
  | "store" | "marketing" | "revenue" | "activity" | "settings";
type NavItem = readonly [string, string, IconName];

const mainNav: readonly NavItem[] = [
  ["/admin", "Início", "home"], ["/admin/orders", "Pedidos", "orders"],
  ["/admin/products", "Produtos", "products"], ["/admin/inventory", "Estoque", "inventory"],
  ["/admin/customers", "Clientes", "customers"],
];
const toolsNav: readonly NavItem[] = [
  ["/admin/categories", "Categorias", "categories"], ["/admin/store/banners", "Banners", "marketing"],
  ["/admin/store/catalog", "Loja", "store"], ["/admin/coupons", "Cupons", "marketing"],
  ["/admin/campaigns", "Campanhas", "activity"], ["/admin/finance", "Financeiro", "revenue"],
  ["/admin/operations", "Relatórios", "activity"], ["/admin/tasks", "Tarefas", "activity"],
  ["/admin/settings", "Configurações", "settings"],
];
const focusable = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])";

function Navigation({ items, close }: Readonly<{ items: readonly NavItem[]; close: () => void }>) {
  return <>{items.map(([to, label, icon]) => (
    <Link key={to} to={to} className={styles.navItem} activeOptions={{ exact: to === "/admin" }}
      activeProps={{ "data-status": "active" }} onClick={close}>
      <DashboardIcon name={icon} /><span>{label}</span>
    </Link>
  ))}</>;
}

function useMobileMenu(open: boolean, close: () => void, opener: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const navigation = document.getElementById("admin-navigation");
    navigation?.querySelector<HTMLElement>(focusable)?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !navigation) return;
      const nodes = [...navigation.querySelectorAll<HTMLElement>(focusable)];
      const first = nodes[0];
      const last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      opener.current?.focus();
    };
  }, [close, open, opener]);
}

function Sidebar({ open, close, storefrontUrl }: Readonly<{
  open: boolean; close: () => void; storefrontUrl: string | null;
}>): React.JSX.Element {
  return <aside id="admin-navigation" className={`${styles.sidebar} ${open ? styles.open : ""}`}>
    <Link to="/admin" className={styles.brand} onClick={close}>kataluu</Link>
    <nav className={styles.nav} aria-label="Principal">
      <Navigation items={mainNav} close={close} />
      <span className={styles.navLabel}>Mais ferramentas</span>
      <Navigation items={toolsNav} close={close} />
    </nav>
    <div className={styles.footer}>{storefrontUrl ? (
      <a className={styles.storeLink} href={storefrontUrl} target="_blank" rel="noreferrer">
        Abrir loja<DashboardIcon name="store" />
      </a>
    ) : null}</div>
  </aside>;
}

export function AdminShell({ children, storefrontUrl }: Readonly<{
  children: ReactNode; storefrontUrl: string | null;
}>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const close = (): void => { setOpen(false); };
  const showMenu = (): void => { opener.current = document.activeElement as HTMLElement | null; setOpen(true); };
  useMobileMenu(open, close, opener);
  return <div className={`admin ${styles.shell}`}>
    <a className="adminSkip" href="#admin-content">Ir para o conteúdo</a>
    {open ? <button className={styles.overlay} onClick={close} aria-label="Fechar menu" /> : null}
    <Sidebar open={open} close={close} storefrontUrl={storefrontUrl} />
    <div className={styles.main}>
      <header className={styles.topbar}>
        <button className={styles.menuButton} type="button" onClick={showMenu}
          aria-controls="admin-navigation" aria-expanded={open} aria-label="Abrir menu">
          <DashboardIcon name="menu" />
        </button>
        <span className={styles.context}>Painel da loja</span>
      </header>
      <main className={styles.content} id="admin-content">{children}</main>
    </div>
    <nav className={styles.mobileBar} aria-label="Atalhos">
      {mainNav.slice(0, 4).map(([to, label, icon]) => (
        <Link key={to} to={to} className={styles.mobileItem}><DashboardIcon name={icon} /><span>{label}</span></Link>
      ))}
      <button className={styles.mobileItem} type="button" onClick={showMenu}
        aria-controls="admin-navigation" aria-expanded={open}>
        <DashboardIcon name="menu" /><span>Menu</span>
      </button>
    </nav>
  </div>;
}
