import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";

export const Route = createFileRoute("/master/audit")({
  component: MasterAudit,
});

function MasterAudit() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Auditoria"
        description="Ações administrativas e eventos relevantes da plataforma."
      />
      <MasterPanel title="Eventos">
        <MasterEmptyState
          title="Log ainda não carregado"
          description="A tela não inventa eventos: somente dados do audit log serão exibidos aqui."
        />
      </MasterPanel>
    </div>
  );
}
