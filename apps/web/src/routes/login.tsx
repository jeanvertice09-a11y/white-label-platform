import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingPanel } from "../features/public/onboarding-panel.tsx";
import { PublicBrandMark, publicBrandStyle } from "../features/public/public-shell.tsx";
import type { ControlOnboardingData } from "../lib/control-onboarding.types.ts";
import { parseLoginSearch, postLoginLocation } from "../lib/login-flow.ts";
import type { PublicLoginExperience } from "../lib/public-site.types.ts";
import { getBrowserClient, signInWithPassword } from "../lib/supabase-client.ts";
import { getControlOnboarding } from "../lib/server/control-onboarding.functions.ts";
import { getPublicLoginExperience } from "../lib/server/public-site.functions.ts";
import { getLoginTarget } from "../lib/server/routing.functions.ts";
import "../styles/public.css";
import "../styles/auth-responsive.css";

export const Route = createFileRoute("/login")({
  validateSearch: parseLoginSearch,
  loaderDeps: ({ search }) => ({ onboarding: search.onboarding === true }),
  loader: async ({ deps }) => {
    const [destination, experience] = await Promise.all([getLoginTarget(), getPublicLoginExperience()]);
    let onboarding: ControlOnboardingData | null = null;
    if (deps.onboarding && destination === "/control") {
      onboarding = await getControlOnboarding();
    }
    if (onboarding?.complete) {
      // TanStack Router redirects are intentionally thrown control-flow objects.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/control" });
    }
    return { destination, experience, onboarding };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.experience.brand.name ?? "Plataforma"} | Acesso` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});

function AccessChooser({ experience }: Readonly<{ experience: PublicLoginExperience }>): React.JSX.Element {
  const brand = experience.brand;
  return (
    <main className="public-auth" style={publicBrandStyle(brand)}><section className="public-auth__card"><a className="public-auth__brand" href="/"><PublicBrandMark brand={brand} /></a><div className="public-auth__intro"><span className="public-eyebrow">Acesso</span><h1>Escolha o ambiente correto.</h1><p>{experience.tenantBranded ? "O acesso desta White Label acontece pelo domínio do painel configurado pela empresa." : "Use o endereço correspondente ao seu papel na plataforma."}</p></div>{experience.tenantBranded ? (experience.panelLoginUrl ? <a className="public-button public-button--primary public-auth__choice" href={experience.panelLoginUrl}>Acessar painel da White Label</a> : <div className="public-auth__notice"><strong>Painel ainda não publicado.</strong><p>O domínio de acesso precisa ser configurado e verificado antes do login.</p></div>) : <div className="public-auth__choices"><a className="public-button public-button--primary" href="https://app.kataluu.com.br/login">Acesso White Label</a><a className="public-button public-button--quiet" href="https://control.geral.kataluu.com.br/login">Administração Kataluu</a></div>}</section></main>
  );
}

function LoginPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (data.onboarding) return <OnboardingPanel data={data.onboarding} />;
  if (data.destination === "/") return <AccessChooser experience={data.experience} />;

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!data.experience.available) {
      setMessage("Este endereço não está disponível para acesso.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const emailValue = form.get("email");
    const passwordValue = form.get("password");
    const email = typeof emailValue === "string" ? emailValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";
    setBusy(true); setMessage("");
    try {
      await signInWithPassword(email, password);
      const { data: sessionData } = await getBrowserClient().auth.getSession();
      if (!sessionData.session) throw new Error("Sessão não foi persistida. Tente novamente.");
      if (data.destination === "/admin") {
        const client = getBrowserClient();
        const rpcResult: unknown = await client.rpc("resolve_my_store_admin_destination", {
          p_hostname: window.location.hostname,
        });
        if (typeof rpcResult !== "object" || rpcResult === null) {
          throw new Error("Não foi possível validar o acesso à loja. Tente novamente.");
        }
        const result = rpcResult as { data?: unknown; error?: unknown };
        if (result.error) throw new Error("Não foi possível validar o acesso à loja. Tente novamente.");
        const hostname = result.data;
        if (typeof hostname !== "string" || hostname.length === 0) {
          await client.auth.signOut();
          throw new Error("Este usuário não possui acesso a uma loja disponível.");
        }
        const target = new URL("/admin", window.location.origin);
        target.hostname = hostname;
        window.location.assign(target.toString());
        return;
      }
      const next = postLoginLocation(data.destination);
      window.location.assign(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally { setBusy(false); }
  }

  const brand = data.experience.brand;
  return (
    <main className="public-auth" style={publicBrandStyle(brand)}><section className="public-auth__card" aria-labelledby="login-title"><a className="public-auth__brand" href="/"><PublicBrandMark brand={brand} /></a><div className="public-auth__intro"><span className="public-eyebrow">Acesso seguro</span><h1 id="login-title">Entrar na plataforma</h1><p>{data.experience.tenantBranded ? `Use suas credenciais para acessar o ambiente de ${brand.name}.` : "Use suas credenciais para acessar o painel correspondente ao seu perfil."}</p></div>{data.experience.available ? <form onSubmit={(event) => { void submit(event); }}><fieldset disabled={busy}><label htmlFor="login-email">E-mail</label><input id="login-email" name="email" type="email" autoComplete="email" required /><label htmlFor="login-password">Senha</label><input id="login-password" name="password" type="password" autoComplete="current-password" required /><button className="public-button public-button--primary" type="submit">{busy ? "Entrando…" : "Entrar"}</button></fieldset></form> : <div className="public-auth__notice" role="status"><strong>Este endereço não está disponível para acesso.</strong><p>Confirme o domínio da plataforma ou use o endereço de acesso fornecido pela empresa responsável.</p></div>}{message ? <p className="public-auth__message" role="alert">{message}</p> : null}</section></main>
  );
}
