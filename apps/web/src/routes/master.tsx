import { createFileRoute } from "@tanstack/react-router";
import { loadMasterContext } from "../lib/client-guard.ts";
import { AccessDenied } from "./-access-denied.tsx";

export const Route = createFileRoute("/master")({
  loader: () => loadMasterContext(),
  errorComponent: AccessDenied,
  component: () => (
    <section>
      <h1>White Label Platform — Master</h1>
      <p>Área da plataforma. Acesso restrito a platform_owner / platform_admin.</p>
      <ul>
        <li>Tenants (placeholder)</li>
        <li>Stores (placeholder)</li>
        <li>Domains (placeholder)</li>
        <li>Security (placeholder)</li>
      </ul>
    </section>
  ),
});