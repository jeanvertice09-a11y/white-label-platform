import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";

export const Route = createFileRoute("/master/platforms")({
  component: MasterPlatforms,
});

function MasterPlatforms() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Plataformas"
        description="Gestão das White Labels conectadas à Kataluu."
      />
      <MasterPanel title="White Labels">
        <MasterEmptyState
          title="Listagem ainda não conectada"
          description="A interface está pronta para receber os dados reais do módulo de plataformas."
        />
      </MasterPanel>
    </div>
  );
}
