import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRootTarget } from "../lib/server/routing.functions.ts";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const target = await getRootTarget();
    if (target !== null) {
      throw redirect({ to: target });
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 32,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: "#f7f8fa",
      color: "#111318",
    }}>
      <section style={{ maxWidth: 720, textAlign: "center" }}>
        <strong style={{ fontSize: 14, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Kataluu
        </strong>
        <h1 style={{ fontSize: "clamp(36px, 7vw, 64px)", margin: "18px 0 14px", letterSpacing: "-.05em" }}>
          Sua operação digital em uma única plataforma.
        </h1>
        <p style={{ color: "#69707d", lineHeight: 1.6, fontSize: 17 }}>
          Gestão, catálogo, vendas e operação para plataformas White Label e seus lojistas.
        </p>
      </section>
    </main>
  );
}
