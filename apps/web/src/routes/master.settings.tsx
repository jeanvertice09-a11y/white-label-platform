import { createFileRoute } from "@tanstack/react-router";
import {
  MasterPageHeader,
  MasterPanel,
} from "../components/master/ui.tsx";

const groups = [
  ["Geral", "Identidade e preferências da plataforma"],
  ["Segurança", "Políticas administrativas e autenticação"],
  ["Domínios", "Domínios de sistema e resolução"],
  ["Integrações", "Provedores externos da Kataluu"],
  ["Comunicação", "Canais e templates operacionais"],
  ["Billing interno", "Regras de cobrança Kataluu → White Label"],
] as const;

export const Route = createFileRoute("/master/settings")({
  component: MasterSettings,
});

function MasterSettings() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Configurações"
        description="Configurações globais da plataforma Kataluu."
      />
      <div className="master-grid master-grid--three">
        {groups.map(([title, description]) => (
          <article className="master-card master-setting" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span>Configuração ainda não conectada</span>
          </article>
        ))}
      </div>
      <MasterPanel title="Estado da configuração">
        <p className="master-muted">
          Controles editáveis serão habilitados somente quando houver persistência e autorização server-side correspondentes.
        </p>
      </MasterPanel>
    </div>
  );
}
