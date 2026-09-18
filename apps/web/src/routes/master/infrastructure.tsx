import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { SectionHeader } from "@white-label/ui";
import { EmptyState } from "@white-label/ui";
import { Card } from "@white-label/ui";

const services = [
  { name: "Vercel", description: "Hospedagem e deploy", status: "pending" },
  { name: "Supabase", description: "Banco de dados e Auth", status: "pending" },
  { name: "Cloudflare", description: "CDN e DNS", status: "pending" },
  { name: "R2", description: "Armazenamento de objetos", status: "pending" },
  { name: "Workers", description: "Funções serverless", status: "pending" },
  { name: "Webhooks", description: "Integrações externas", status: "pending" },
];

export const Route = createFileRoute("/master/infrastructure")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Infraestrutura"
        description="Monitoramento e status dos serviços de infraestrutura."
      />
      <div className="grid-auto-fit">
        {services.map((service) => (
          <Card key={service.name} padding="md" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-[var(--color-foreground)]">
                  {service.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
                  {service.description}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-foreground-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--color-neutral-400)]" aria-hidden="true" />
                <span>Monitoramento não configurado</span>
              </span>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <EmptyState
          variant="minimal"
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          title="Monitoramento não configurado"
          description="Configure as integrações com os provedores de infraestrutura para monitorar o status dos serviços."
        />
      </div>
    </>
  ),
});