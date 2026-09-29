import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";

export const Route = createFileRoute("/master/support")({
  component: MasterSupport,
});

function MasterSupport() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Suporte"
        description="Acompanhamento de solicitações das plataformas e lojistas."
      />
      <MasterPanel title="Chamados">
        <MasterEmptyState
          title="Fonte de chamados ainda não conectada"
          description="Os chamados reais aparecerão aqui quando o módulo de suporte estiver integrado."
        />
      </MasterPanel>
    </div>
  );
}
