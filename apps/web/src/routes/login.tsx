import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getBrowserClient, signInWithPassword, signOut } from "../lib/supabase-client.ts";
import { Button } from "@white-label/ui";
import { Input } from "@white-label/ui";
import { Label } from "@white-label/ui";
import { Card } from "@white-label/ui";
import { Divider } from "@white-label/ui";

function handleAuthError(err: unknown): string {
  return err instanceof Error ? err.message : "Falha na operação";
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
        if (data.session) {
          void navigate({ to: "/master" });
        } else {
          setError("Login falhou: sessão não criada");
        }
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

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background-muted)] px-4 py-12">
        <Card padding="lg" className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Bem-vindo ao Kataluu</h1>
            <p className="mt-2 text-[var(--color-foreground-muted)]">
              Acesse sua conta de Super Admin
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger-foreground)] text-sm" role="alert">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <Divider className="my-6" />

          <div className="text-center text-sm text-[var(--color-foreground-muted)]">
            <p>Kataluu — White Label Platform</p>
            <p className="mt-1">Super Admin Access</p>
          </div>
        </Card>
      </div>
    );
  },
});