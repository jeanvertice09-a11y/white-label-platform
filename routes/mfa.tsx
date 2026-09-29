import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import "../styles/public.css";
import "../styles/auth-responsive.css";

export const Route = createFileRoute("/mfa")({
  head: () => ({
    meta: [
      { title: "Acesso | Kataluu" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MfaBypassPage,
});

const ALLOWED_NEXT = new Set(["/master", "/control", "/admin", "/login?onboarding=true"]);

function safeNext(): string {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("next") ?? "";
  return ALLOWED_NEXT.has(value) ? value : "/";
}

function MfaBypassPage(): React.JSX.Element {
  useEffect(() => {
    window.location.replace(safeNext());
  }, []);

  return (
    <main className="public-auth">
      <section className="public-auth__card">
        <div className="public-auth__intro">
          <span className="public-eyebrow">Ambiente de testes</span>
          <h1>Redirecionando…</h1>
          <p>A verificação em duas etapas está temporariamente desativada neste ambiente.</p>
        </div>
      </section>
    </main>
  );
}
