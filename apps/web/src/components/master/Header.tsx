import { useNavigate } from "@tanstack/react-router";
import { signOut } from "../../lib/supabase-client.ts";

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
    <header className="master-header">
      <button
        type="button"
        className="master-icon-button master-header__menu"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div className="master-header__title">
        <span className="master-header__eyebrow">Super Admin</span>
        <strong>Kataluu</strong>
      </div>
      <div className="master-header__actions">
        <span className="master-account">Conta da plataforma</span>
        <button
          type="button"
          className="master-button master-button--secondary"
          onClick={() => { void handleLogout(); }}
        >
          Sair
        </button>
      </div>
    </header>
  );
}
