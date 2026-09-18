import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { EmptyState } from "@white-label/ui";

export const Route = createFileRoute("/master/support")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Suporte"
        description="Gerencie solicitações de suporte das plataformas e lojistas."
      />
      <EmptyState
        icon={
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
        title="Nenhum chamado de suporte"
        description="Os chamados de suporte das plataformas e lojistas aparecerão aqui."
      />
    </>
  ),
});