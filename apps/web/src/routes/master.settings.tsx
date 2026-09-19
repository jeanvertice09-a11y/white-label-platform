import { createFileRoute } from "@tanstack/react-router";
import { MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";

const groups = [
  ["Geral", "Identidade e preferências da plataforma"],
  ["Segurança", "Políticas administrativas e autenticação"],
  ["Domínios", "Domínios de sistema e resolução"],
  ["Integrações", "Provedores externos da Kataluu"],
  ["Comunicação", "Canais e templates operacionais"],
  ["Billing interno", "Regras de cobrança Kataluu → White Label"],
] as const;

export const Route = createFileRoute("/master/settings")({ component: MasterSettings });

function MasterSettings() {
  return (
    <div className="master-stack console-page">
      <MasterPageHeader title="Configurações" description="Áreas globais da Kataluu e o estado real de disponibilidade de cada configuração." />
      <MasterPanel title="Áreas de configuração">
        <div className="console-settings-list">
          {groups.map(([title, description]) => (
            <div className="console-settings-row" key={title}>
              <div><strong>{title}</strong><small>{description}</small></div>
              <span className="console-status">Ainda não conectada</span>
            </div>
          ))}
        </div>
        <p className="console-panel-note">Controles editáveis só serão exibidos quando houver persistência e autorização server-side correspondentes.</p>
      </MasterPanel>
    </div>
  );
}
