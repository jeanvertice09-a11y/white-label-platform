import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { EmptyState } from "@white-label/ui";

export const Route = createFileRoute("/master/audit")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Auditoria"
        description="Log de ações e eventos do sistema."
      />
      <div className="space-y-4">
        <p className="text-[var(--color-foreground-muted)]">
          O log de auditoria exibirá aqui todas as ações realizadas no sistema,
          incluindo: criação de plataformas, alterações de configuração, ações de usuários, etc.
        </p>
        <div className="bg-[var(--color-background-card)] border border-[var(--color-border)] rounded-xl p-6">
          <p className="text-[var(--color-foreground-muted)] text-center py-8">
            Nenhum registro de auditoria ainda.
          </p>
        </div>
      </div>
    </>
  ),
});