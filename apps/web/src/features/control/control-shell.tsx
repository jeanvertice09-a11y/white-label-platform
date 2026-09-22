import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DashboardIcon } from "../../components/dashboard/DashboardIcon.tsx";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";
import { signOut } from "../../lib/supabase-client.ts";
import { statusLabel } from "../../lib/ui-labels.ts";
import { controlNavigation, isControlNavigationItemActive } from "./control-navigation.ts";

const ControlShellContext = createContext<TenantControlDashboardData | null>(null);

export function useControlShellData(): TenantControlDashboardData {
  const value = useContext(ControlShellContext);
  if (!value) throw new Error("Contexto do painel da White Label indisponível.");
  return value;
}

function ControlSidebarAccount({ data }: Readonly<{ data: TenantControlDashboardData }>): React.JSX.Element {
  const navigate = useNavigate();
  async function handleLogout(): Promise<void> {
    try { await signOut(); }
    finally { await navigate({ to: "/login" }); }
  }
  return <div className="control-sidebar__account">
    <span className="control-sidebar__avatar" aria-hidden="true">{data.tenant.name.slice(0, 1).toUpperCase()}</span>
    <div><strong>{statusLabel(data.tenant.status)}</strong><small>{data.tenant.slug}</small></div>
    <button type="button" className="control-sidebar__logout" onClick={() => { void handleLogout(); }} aria-label="Sair da conta" title="Sair"><DashboardIcon name="logout" /></button>
  </div>;
}

function ControlSidebar({ data, open, onClose }: Readonly<{ data: TenantControlDashboardData; open: boolean; onClose: () => void }>): React.JSX.Element {
  const location = useRouterState({ select: (state) => state.location });
  return <>
    <button type="button" className={open ? "control-overlay is-open" : "control-overlay"} onClick={onClose} aria-label="Fechar menu" tabIndex={open ? 0 : -1} />
    <aside id="control-navigation" className={open ? "control-sidebar is-open" : "control-sidebar"} aria-label="Navegação da White Label">
      <div className="control-brand"><span className="control-brand__mark" aria-hidden="true">{data.tenant.name.slice(0, 1).toUpperCase()}</span><div><strong>{data.tenant.name}</strong><small>Painel da White Label</small></div></div>
      <nav className="control-nav" aria-label="Áreas do painel">
        {controlNavigation.map((group) => <div className="console-nav-group" key={group.label}>
          <span className="console-nav-group__label">{group.label}</span>
          {group.items.map((item) => {
            const active = isControlNavigationItemActive(item, location.pathname, location.href);
            const search = item.to === "/control/plans" ? { section: item.planSection ?? "plans" } : {};
            return <Link
              key={`${item.to}:${item.planSection ?? item.label}`}
              to={item.to as never}
              search={search as never}
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onClose}
            ><DashboardIcon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </div>)}
      </nav>
      <ControlSidebarAccount data={data} />
    </aside>
  </>;
}

export function ControlShell({ data }: Readonly<{ data: TenantControlDashboardData }>): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstLink = document.querySelector<HTMLAnchorElement>("#control-navigation a");
    firstLink?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return <ControlShellContext.Provider value={data}>
    <div className="control-shell console-shell">
      <a className="console-skip-link" href="#control-content">Pular para o conteúdo</a>
      <ControlSidebar data={data} open={mobileOpen} onClose={() => { setMobileOpen(false); }} />
      <main className="control-main console-shell__content">
        <div className="control-mobile-bar"><button ref={menuButtonRef} type="button" className="control-mobile-bar__menu" onClick={() => { setMobileOpen(true); }} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="control-navigation"><DashboardIcon name="menu" /></button><div><strong>{data.tenant.name}</strong><span>Painel da White Label</span></div></div>
        <div className="control-content console-container" id="control-content" tabIndex={-1}><Outlet /></div>
      </main>
    </div>
  </ControlShellContext.Provider>;
}
