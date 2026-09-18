import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { getBrowserClient, signInWithPassword } from "../lib/supabase-client.ts";
import "../styles/master.css";

function handleAuthError(err: unknown): string {
  return err instanceof Error ? err.message : "Falha na operação";
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(ev: FormEvent<HTMLFormElement>): Promise<void> {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithPassword(email, password);
      const { data } = await getBrowserClient().auth.getSession();
      if (!data.session) throw new Error("Login falhou: sessão não criada");
      await navigate({ to: "/master" });
    } catch (err) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span>K</span><strong>Kataluu</strong></div>
        <div className="auth-heading">
          <h1>Acessar Super Admin</h1>
          <p>Use sua conta administrativa da plataforma.</p>
        </div>
        <form onSubmit={(ev) => { void submit(ev); }} className="auth-form">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required disabled={loading}
            value={email} onChange={(ev: ChangeEvent<HTMLInputElement>) => setEmail(ev.target.value)} />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete="current-password" required disabled={loading}
            value={password} onChange={(ev: ChangeEvent<HTMLInputElement>) => setPassword(ev.target.value)} />
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="master-button master-button--primary" type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
