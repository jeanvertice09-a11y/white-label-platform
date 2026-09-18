import { createFileRoute } from "@tanstack/react-router";
import { MasterPageHeader } from "../components/master/ui.tsx";

const services = [
  ["Vercel", "Hospedagem e deploy"],
  ["Supabase", "Banco de dados e autenticação"],
  ["Cloudflare", "DNS e CDN"],
  ["R2", "Armazenamento de mídia"],
  ["Worker", "Processamento assíncrono"],
  ["Webhooks", "Integrações externas"],
] as const;

export const Route = createFileRoute("/master/infrastructure")({
  component: MasterInfrastructure,
});

function MasterInfrastructure() {
  return (
    <div className="master-stack">
      <MasterPageHeader
        title="Infraestrutura"
        description="Mapa operacional dos serviços usados pela plataforma."
      />
      <div className="master-grid master-grid--three">
        {services.map(([name, description]) => (
          <article className="master-card master-service" key={name}>
            <span className="master-service__status">Não monitorado</span>
            <h2>{name}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
