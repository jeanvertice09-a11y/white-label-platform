import { createFileRoute } from "@tanstack/react-router";
import { AdminPage, Card } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/store")({
  component: StorePage,
});

function StorePage(): React.JSX.Element {
  return (
    <AdminPage title="Minha loja" description="Aparência, banners e configurações do catálogo.">
      <Card>
        <div style={{ display: "grid", gap: 12 }}>
          <a href="/admin/store/appearance">Aparência</a>
          <a href="/admin/store/banners">Banners</a>
          <a href="/admin/store/catalog">Configurações do catálogo</a>
        </div>
      </Card>
    </AdminPage>
  );
}
