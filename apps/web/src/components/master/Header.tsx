import { useNavigate } from "@tanstack/react-router";
import { signOut } from "../../lib/supabase-client.ts";
import { DashboardIcon } from "../dashboard/DashboardIcon.tsx";

interface MasterHeaderProps {
  onMenuClick: () => void;
}

export function MasterHeader({ onMenuClick }: Readonly<MasterHeaderProps>) {
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    try {
      await signOut();
    } finally {
      await navigate({ to: "/login" });
    }
  }

  return (
    <header className="master-header console-header">
      <button
        type="button"
        className="master-icon-button master-header__menu"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <DashboardIcon name="menu" />
      </button>
      <div className="master-header__title console-header__context">
        <span>Plataforma</span>
        <strong>Super Admin</strong>
      </div>
      <div className="master-header__actions">
        <div className="master-account" aria-label="Conta atual">
          <span className="master-account__avatar" aria-hidden="true">K</span>
          <span>Conta da plataforma</span>
        </div>
        <button
          type="button"
          className="master-icon-button"
          onClick={() => { void handleLogout(); }}
          aria-label="Sair da conta"
          title="Sair"
        >
          <DashboardIcon name="logout" />
        </button>
      </div>
    </header>
  );
}
