import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { EmptyState } from "@white-label/ui";
import { MetricCard } from "@white-label/ui";
import { Divider } from "@white-label/ui";

export const Route = createFileRoute("/master/")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo operacional da Kataluu"
      />
      <div className="grid-auto-fit mb-8">
        <MetricCard
          title="Receita recebida"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Plataformas ativas"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Lojistas faturáveis"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Em trial"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Faturas em aberto"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
      </div>

      <div className="grid-auto-fit mb-8">
        <MetricCard
          title="Faturas vencidas"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Novas plataformas no período"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Novos lojistas no período"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Renovações no período"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
      </div>

      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
              Atividade recente
            </h2>
          </div>
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L6 10l-3-9" />
              </svg>
            }
            title="Nenhuma atividade recente"
            description="As atividades recentes aparecerão aqui quando houver eventos registrados."
            variant="minimal"
          />
        </section>

        <Divider />

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
              Requer atenção
            </h2>
          </div>
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            }
            title="Nenhum item requer atenção"
            description="Itens que requerem atenção aparecerão aqui automaticamente."
            variant="minimal"
          />
        </section>
      </div>
    </>
  ),
});