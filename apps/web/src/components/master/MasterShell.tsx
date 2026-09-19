import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardIcon } from "../dashboard/DashboardIcon.tsx";
import { MasterSidebar } from "./Sidebar.tsx";

export function MasterShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="master-shell console-shell">
      <a className="console-skip-link" href="#master-content">Pular para o conteúdo</a>
      <MasterSidebar
        open={mobileOpen}
        onClose={() => { setMobileOpen(false); }}
      />
      <div className="master-shell__content console-shell__content">
        <div className="master-mobile-bar">
          <button
            type="button"
            className="master-mobile-bar__menu"
            onClick={() => { setMobileOpen(true); }}
            aria-label="Abrir menu"
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
