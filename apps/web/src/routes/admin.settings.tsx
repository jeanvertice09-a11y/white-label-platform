import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="k-page">
      <PageHead
        title="Configurações"
        description="A fundação atual concentra as configurações relacionadas à loja e ao catálogo."
      />
      <div className="k-card">
        <h2>Configurações da loja</h2>
        <p className="k-muted">Acesse aparência, banners, catálogo, WhatsApp e checkout.</p>
        <Link className="k-button" to="/admin/store">Abrir Minha loja</Link>
      </div>
    </div>
  );
}
