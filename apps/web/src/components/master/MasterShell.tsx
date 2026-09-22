import { Outlet } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { DashboardIcon } from "../dashboard/DashboardIcon.tsx";
import { useMobileDrawerFocus } from "../console/mobile-drawer-focus.ts";
import { MasterSidebar } from "./Sidebar.tsx";
import "../../styles/panel-navigation-lot1.css";

export function MasterShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => { menuButtonRef.current?.focus(); });
  }, []);

  useMobileDrawerFocus(mobileOpen, "master-navigation", closeMobileMenu);

  return (
    <div className="master-shell console-shell">
      <a className="console-skip-link" href="#master-content">Pular para o conteúdo</a>
      <MasterSidebar
        open={mobileOpen}
        onClose={closeMobileMenu}
      />
      <div className="master-shell__content console-shell__content">
        <div className="master-mobile-bar">
          <button
            ref={menuButtonRef}
            type="button"
            className="master-mobile-bar__menu"
            onClick={() => { setMobileOpen(true); }}
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-controls="master-navigation"
          >
            <DashboardIcon name="menu" />
          </button>
          <div>
            <strong>Kataluu</strong>
            <span>Administração da plataforma</span>
          </div>
        </div>
        <main className="master-main console-main" id="master-content" tabIndex={-1}>
          <div className="master-container console-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
