import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../../lib/client-guard.ts";
import { AccessDenied } from "../-access-denied.tsx";
import { PageHeader } from "@white-label/ui";
import { EmptyState } from "@white-label/ui";
import { Button } from "@white-label/ui";

export const Route = createFileRoute("/master/platforms")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <>
      <PageHeader
        title="Plataformas"
        description="Gerencie as White Labels conectadas à Kataluu."
        actions={[
          { variant: "primary", children: "Nova plataforma" },
        ]}
      />
      <EmptyState
        icon={
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
        }
        title="Nenhuma plataforma encontrada"
        description="Nenhuma White Label foi configurada ainda."
        action={{
          variant: "primary",
          children: "Nova plataforma",
        }}
      />
    </>
  ),
});