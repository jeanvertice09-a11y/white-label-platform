import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { EmptyState } from "@white-label/ui";
import { MetricCard } from "@white-label/ui";
import { Divider } from "@white-label/ui";

export const Route = createFileRoute("/master/billing")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Faturamento"
        description="Visão geral financeira da Kataluu"
      />
      <div className="grid-auto-fit mb-8">
        <MetricCard
          title="Total recebido"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Em aberto"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Vencido"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
        <MetricCard
          title="Próximo fechamento semanal"
          value="—"
          description="Dados ainda não disponíveis"
          loading={true}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
          Faturas recentes
        </h2>
        <div className="bg-[var(--color-background-card)] border border-[var(--color-border)] rounded-xl">
          <div className="p-4 border-b border-[var(--color-border)]">
            <p className="text-[var(--color-foreground-muted)] text-sm">
              Nenhuma fatura registrada ainda.
            </p>
          </div>
        </div>
      </div>
    </>
  ),
});