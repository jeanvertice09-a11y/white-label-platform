import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage(): React.JSX.Element {
  return (
    <div className="k-page">
      <PageHead
        title="Configurações"
        description="Ajustes disponíveis para a operação atual da loja."
      />
      <section className="k-workspace-section">
        <header className="k-section-head">
          <div>
            <span className="k-section-kicker">Loja</span>
            <h2>Experiência pública</h2>
            <p>Aparência, banners, catálogo, WhatsApp e checkout ficam centralizados em Minha Loja.</p>
          </div>
        </header>
        <div className="k-config-list">
          <Link className="k-config-row" to="/admin/store">
            <span>
              <strong>Minha Loja</strong>
              <small>Abra o configurador e a prévia pública.</small>
            </span>
            <b aria-hidden="true">→</b>
          </Link>
        </div>
      </section>
    </div>
  );
}
