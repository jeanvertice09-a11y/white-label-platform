import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { MasterHeader } from "./Header.tsx";
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
        <MasterHeader onMenuClick={() => { setMobileOpen(true); }} />
        <main className="master-main console-main" id="master-content" tabIndex={-1}>
          <div className="master-container console-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
