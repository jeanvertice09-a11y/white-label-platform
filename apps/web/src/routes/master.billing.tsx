import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterMetricCard,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";

export const Route = createFileRoute("/master/billing")({
  component: MasterBilling,
});

function MasterBilling() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Faturamento"
        description="Visão financeira da relação Kataluu → White Labels."
      />
      <div className="master-metrics">
        <MasterMetricCard label="Total recebido" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Em aberto" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Vencido" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Próximo fechamento" detail="Sem dados consolidados ainda" />
      </div>
      <MasterPanel title="Faturas recentes">
        <MasterEmptyState
          title="Faturas ainda não carregadas"
          description="Nenhuma informação financeira é simulada nesta tela."
        />
      </MasterPanel>
    </div>
  );
}
