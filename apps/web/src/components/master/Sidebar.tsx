import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Avatar } from "@white-label/ui";
import { Divider } from "@white-label/ui";
import { SidebarItem } from "@white-label/ui";
import { signOut } from "../../lib/supabase-client";

const navigation = [
  { label: "Visão geral", href: "/master", icon: HomeIcon },
  { label: "Plataformas", href: "/master/platforms", icon: PlatformsIcon },
  { label: "Faturamento", href: "/master/billing", icon: BillingIcon },
  { label: "Suporte", href: "/master/support", icon: SupportIcon },
  { label: "Auditoria", href: "/master/audit", icon: AuditIcon },
  { label: "Infraestrutura", href: "/master/infrastructure", icon: InfrastructureIcon },
  { label: "Configurações", href: "/master/settings", icon: SettingsIcon },
];

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PlatformsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function InfrastructureIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M6 11h12" />
      <path d="M6 15h12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06-.06a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51" />
    </svg>
  );
}

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.href]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch {
      navigate({ to: "/login" });
    }
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[var(--z-drawer)] bg-[var(--color-neutral-900)/0.5] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-[var(--z-sticky)]
          w-[var(--sidebar-width)]
          bg-[var(--color-background-card)]
          border-r border-[var(--color-border)]
          flex flex-col
          transition-all duration-300 ease-out
          ${collapsed ? "w-[var(--sidebar-width-collapsed)]" : ""}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `.trim()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--color-border)]">
            <Link
              to="/master"
              className={`
                flex items-center gap-2
                text-[var(--color-foreground)]
                font-bold text-lg
                transition-opacity
                ${collapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100"}
              `.trim()}
              aria-label="Kataluu - Início"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--color-primary)]"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              {!collapsed && <span>Kataluu</span>}
            </Link>
            <button
              type="button"
              className={`
                p-2 rounded-lg text-[var(--color-foreground-muted)]
                hover:text-[var(--color-foreground)] hover:bg-[var(--color-background-hover)]
                lg:hidden
              `.trim()}
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu principal">
            {navigation.map((item) => (
              <SidebarItem
                key={item.href}
                label={item.label}
                href={item.href}
                icon={item.icon}
              />
            ))}
          </nav>

          <Divider className="mx-3" />

          {/* User section */}
          <div className={`
            p-3 border-t border-[var(--color-border)]
            ${collapsed ? "px-2" : ""}
          `.trim()}>
            <div className="flex items-center gap-3">
              <Avatar
                name="Super Admin"
                size="md"
                className={collapsed ? "mx-auto" : ""}
              />
              {!collapsed && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                    Super Admin
                  </p>
                  <p className="text-xs text-[var(--color-foreground-muted)] truncate">
                    platform_owner
                  </p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                className={`
                  mt-3 w-full flex items-center justify-center gap-2
                  px-3 py-2 text-sm font-medium
                  text-[var(--color-danger)]
                  hover:bg-[var(--color-danger-muted)]
                  rounded-lg transition-colors
                `.trim()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair
              </button>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[var(--z-drawer)] bg-[var(--color-neutral-900)/0.5] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}