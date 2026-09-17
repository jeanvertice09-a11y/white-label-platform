import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <section>
      <h1>White Label Platform — Fundação</h1>
      <p>
        Monorepo modular multi-tenant. Rotas de esqueleto: /master (plataforma),
        /control (tenant), /admin (store), /catalog (público por hostname).
      </p>
    </section>
  ),
});