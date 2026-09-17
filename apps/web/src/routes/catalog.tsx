import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/catalog")({
  component: () => (
    <section>
      <h1>Catálogo</h1>
      <p>Resolução por hostname (DomainResolver). Nenhum UUID da URL concede acesso.</p>
    </section>
  ),
});