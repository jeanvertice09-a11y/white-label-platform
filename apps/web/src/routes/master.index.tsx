import { createFileRoute } from "@tanstack/react-router";
import {
  MasterEmptyState,
  MasterMetricCard,
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";

export const Route = createFileRoute("/master/")({
  component: MasterDashboard,
});

function MasterDashboard() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Visão geral"
        description="Resumo operacional da plataforma Kataluu."
      />
      <div className="master-metrics">
        <MasterMetricCard label="Receita recebida" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Plataformas ativas" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Lojistas faturáveis" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Em trial" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Faturas em aberto" detail="Sem dados consolidados ainda" />
        <MasterMetricCard label="Faturas vencidas" detail="Sem dados consolidados ainda" />
      </div>
      <div className="master-grid master-grid--two">
        <MasterPanel title="Atividade recente">
          <MasterEmptyState
            title="Sem atividade consolidada"
            description="Eventos auditáveis aparecerão aqui quando a fonte de dados estiver conectada."
          />
        </MasterPanel>
        <MasterPanel title="Requer atenção">
          <MasterEmptyState
            title="Nenhum alerta carregado"
            description="Alertas operacionais serão exibidos somente quando houver dados verificáveis."
          />
        </MasterPanel>
      </div>
    </div>
  );
}
