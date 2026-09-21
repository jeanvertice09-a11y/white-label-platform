import { createFileRoute } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { MasterPlanEntitlementsManager } from "../features/master/master-plan-entitlements-manager.tsx";
import { getPlatformPlanTemplates } from "../lib/server/platform-plan-templates.functions.ts";

const UNAVAILABLE = [
  ["Geral", "Nome interno da plataforma, idioma e fuso operacional."],
  ["Segurança", "Políticas globais de sessão e autenticação administrativa."],
  ["Domínios", "Defaults de DNS e regras globais de roteamento."],
  ["Integrações", "Credenciais e serviços de infraestrutura compartilhados."],
  ["Comunicação", "Remetentes, templates e canais de notificação."],
  ["Billing interno", "Parâmetros globais de faturamento e cobrança interna."],
] as const;

export const Route = createFileRoute("/master/settings")({
  loader: () => getPlatformPlanTemplates(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: MasterSettingsPage,
});

function MasterSettingsPage(): React.JSX.Element {
  const templates = Route.useLoaderData();
  return <div className="master-page master-page--settings">
    <MasterPageHeader title="Configurações" description="Gerencie configurações globais somente quando existir persistência e autorização reais." />
    <MasterPanel title="Templates e entitlements">
      <p>Os valores abaixo vêm do catálogo real de templates da Kataluu. Alterações são validadas e persistidas exclusivamente pelo boundary master no servidor.</p>
      <MasterPlanEntitlementsManager templates={templates} />
    </MasterPanel>
    <div className="master-settings-grid">
      {UNAVAILABLE.map(([title, description]) => <article className="master-settings-card" key={title}><div><span>Configuração de plataforma</span><h2>{title}</h2><p>{description}</p></div><strong>Sem backend configurado</strong></article>)}
    </div>
    <div className="master-settings-note"><strong>Sem controles fictícios.</strong><p>Estas áreas permanecem indisponíveis até existir modelo persistente e autorização server-side específicos.</p></div>
  </div>;
}
