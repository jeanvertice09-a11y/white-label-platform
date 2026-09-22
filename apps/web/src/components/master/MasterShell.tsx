import { Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DashboardIcon } from "../dashboard/DashboardIcon.tsx";
import { MasterSidebar } from "./Sidebar.tsx";
import "../../styles/panel-navigation-lot1.css";

export function MasterShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstLink = document.querySelector<HTMLAnchorElement>("#master-navigation a");
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
