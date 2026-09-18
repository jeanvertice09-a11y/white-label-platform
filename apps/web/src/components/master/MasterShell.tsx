import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { MasterHeader } from "./Header.tsx";
import { MasterSidebar } from "./Sidebar.tsx";

export function MasterShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="master-shell">
      <MasterSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="master-shell__content">
        <MasterHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="master-main">
          <div className="master-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
