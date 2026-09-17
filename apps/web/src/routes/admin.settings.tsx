import { createFileRoute } from "@tanstack/react-router";
import { AdminPage, Card } from "../features/store-admin/ui.tsx";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage(): React.JSX.Element {
  return (
    <AdminPage
      title="Configurações"
      description="Configurações gerais do lojista serão ampliadas sem misturar o escopo do Control."
    >
      <Card>
        <p style={{ margin: 0 }}>
          As configurações de catálogo disponíveis agora ficam em{" "}
          <a href="/admin/store/catalog">Minha loja → Catálogo</a>.
        </p>
      </Card>
    </AdminPage>
  );
}
