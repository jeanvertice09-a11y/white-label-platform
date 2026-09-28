import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DashboardIcon } from "../../components/dashboard/DashboardIcon.tsx";
import styles from "./AdminShell.module.css";

const mainNav = [
  ["/admin", "Início", "home"],
  ["/admin/orders", "Pedidos", "orders"],
  ["/admin/products", "Produtos", "products"],
  ["/admin/inventory", "Estoque", "inventory"],
  ["/admin/customers", "Clientes", "customers"],
] as const;
const storeNav = [
  ["/admin/categories", "Categorias", "categories"],
  ["/admin/marketing", "Divulgação", "marketing"],
  ["/admin/store/catalog", "Loja", "store"],
  ["/admin/finance", "Financeiro", "revenue"],
  ["/admin/settings", "Configurações", "settings"],
] as const;
const focusable = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])";

function Nav({ items, close }: { items: typeof mainNav | typeof storeNav; close: () => void }) {
  return <>{items.map(([to, label, icon]) => (
    <Link key={to} to={to} className={styles.navItem}
      activeOptions={{ exact: to === "/admin" }} activeProps={{ "data-status": "active" }} onClick={close}>
      <DashboardIcon name={icon} /><span>{label}</span>
    </Link>
  ))}</>;
}

export function AdminShell({ children, storefrontUrl }: Readonly<{ children: ReactNode; storefrontUrl: string | null }>) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  function close() { setOpen(false); }
  function showMenu() { opener.current = document.activeElement as HTMLElement | null; setOpen(true); }
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    const drawer = document.getElementById("admin-navigation");
    drawer?.querySelector<HTMLElement>(focusable)?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !drawer) return;
      const nodes = [...drawer.querySelectorAll<HTMLElement>(focusable)];
      const first = nodes[0]; const last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = old; window.removeEventListener("keydown", onKey); opener.current?.focus(); };
  }, [open]);
  return <div className={`admin ${styles.shell}`}>
    <a className="adminSkip" href="#admin-content">Ir para o conteúdo</a>
    {open ? <button className={styles.overlay} onClick={close} aria-label="Fechar menu" /> : null}
    <aside id="admin-navigation" className={`${styles.sidebar} ${open ? styles.open : ""}`}>
      <Link to="/admin" className={styles.brand} onClick={close}><span className={styles.mark}>k</span>Kataluu</Link>
      <nav className={styles.nav} aria-label="Principal"><Nav items={mainNav} close={close} />
        <span className={styles.navLabel}>Loja e vendas</span><Nav items={storeNav} close={close} /></nav>
      <div className={styles.footer}>{storefrontUrl ? <a className={styles.storeLink} href={storefrontUrl}
        target="_blank" rel="noreferrer">Abrir loja <DashboardIcon name="store" /></a> : null}</div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}>
        <button className={styles.menuButton} type="button" onClick={showMenu}
          aria-controls="admin-navigation" aria-expanded={open} aria-label="Abrir menu"><DashboardIcon name="menu" /></button>
        <div className={styles.context}><strong>Minha loja</strong><span>Painel administrativo</span></div>
        <div className={styles.actions}><Link className={styles.primary} to="/admin/products/new">Novo produto</Link></div>
      </header>
      <main className={styles.content} id="admin-content">{children}</main>
    </div>
    <nav className={styles.mobileBar} aria-label="Atalhos">
      {mainNav.slice(0, 4).map(([to, label, icon]) => <Link key={to} to={to} className={styles.mobileItem}>
        <DashboardIcon name={icon} /><span>{label}</span></Link>)}
      <button className={styles.mobileItem} type="button" onClick={showMenu}
        aria-controls="admin-navigation" aria-expanded={open}><DashboardIcon name="menu" /><span>Menu</span></button>
    </nav>
  </div>;
}
