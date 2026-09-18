import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@white-label/ui";
import { Divider } from "@white-label/ui";
import { signOut } from "../../lib/supabase-client";

export function Header() {
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch {
      navigate({ to: "/login" });
    }
  };

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] h-[var(--header-height)] bg-[var(--color-background-card)] border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-background-hover)]"
            aria-label="Abrir menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="hidden lg:block">
            <Link
              to="/master"
              className="flex items-center gap-2 text-[var(--color-foreground)] font-bold text-lg"
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
              <span>Kataluu</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block relative">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-background-hover)] rounded-lg transition-colors"
              aria-label="Busca global"
              disabled
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-[var(--color-foreground-subtle)]">Buscar...</span>
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--color-background-hover)] transition-colors"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="Menu do usuário"
            >
              <Avatar name="Super Admin" size="sm" />
              <span className="hidden md:block text-sm font-medium text-[var(--color-foreground)]">
                Super Admin
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[var(--z-dropdown)-1]"
                  onClick={() => setUserMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-56 bg-[var(--color-background-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 animate-fade-in z-[var(--z-dropdown)]">
                  <div className="px-3 py-2 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">Super Admin</p>
                    <p className="text-xs text-[var(--color-foreground-muted)]">platform_owner</p>
                  </div>
                  <Divider />
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-foreground)] hover:bg-[var(--color-background-hover)]"
                    onClick={() => { void handleLogout(); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}