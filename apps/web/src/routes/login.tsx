import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getBrowserClient, signInWithPassword, signOut } from "../lib/supabase-client.ts";

function handleAuthError(err: unknown): string {
  return err instanceof Error ? err.message : "Falha na operação";
}

function handleChange<T extends HTMLInputElement>(setter: (value: string) => void) {
  return (ev: React.ChangeEvent<T>): void => {
    setter(ev.target.value);
  };
}

export const Route = createFileRoute("/login")({
  component: () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(e: React.SyntheticEvent): Promise<void> {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        await signInWithPassword(email, password);
        const { data } = await getBrowserClient().auth.getSession();
        if (data.session) void navigate({ to: "/" });
        else setError("Login falhou: sessão não criada");
      } catch (err) {
        setError(handleAuthError(err));
      } finally {
        setLoading(false);
      }
    }

    async function handleLogout(): Promise<void> {
      try {
        await signOut();
        void navigate({ to: "/login" });
      } catch (err) {
        setError(handleAuthError(err));
      }
    }

    function onSubmit(ev: React.SyntheticEvent): void {
      ev.preventDefault();
      void handleLogin(ev);
    }

    function onLogoutClick(): void {
      void handleLogout();
    }

    return (
      <section>
        <h1>Login</h1>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={handleChange(setEmail)} required disabled={loading} />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={handleChange(setPassword)} required disabled={loading} />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          <button type="button" onClick={onLogoutClick} disabled={loading}>Sair</button>
        </form>
        {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
      </section>
    );
  },
});