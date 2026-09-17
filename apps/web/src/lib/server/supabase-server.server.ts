// SERVER-ONLY: validação de sessão via Supabase Auth SSR (@supabase/ssr).
// Usa createServerClient com cookie adapter do TanStack Start (getCookies/setCookie/setResponseHeader).
import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import type { Session } from "./session.server.ts";

function assertServer(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error("[supabase-server] Módulo server-only vazou para o client.");
  }
}

function readServerEnv(): { url: string; anonKey: string } {
  assertServer();
  const url = process.env["SUPABASE_URL"];
  const anonKey = process.env["SUPABASE_ANON_KEY"];
  if (!url || !anonKey) throw new Error("[supabase-server] SUPABASE_URL/ANON_KEY ausentes");
  return { url, anonKey };
}

/**
 * Validação server-side REAL: Auth.getUser() confirma o JWT contra o
 * servidor Supabase Auth (não apenas decodifica). Sem backend alcançável
 * ou sessão inválida -> null (fail closed). Usa anon key; service_role
 * nunca é necessária para validar sessão de usuário.
 * Cookie adapter usa getCookies/setCookie/setResponseHeader do TanStack Start
 * para ler/escrever cookies e headers de resposta corretamente.
 */
export async function validateServerSession(): Promise<Session | null> {
  assertServer();
  const { url, anonKey } = readServerEnv();

  // Headers de cache para rotas autenticadas
  setResponseHeader("Cache-Control", "private, no-store");

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const cookies = getCookies();
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(_cookiesToSet, responseHeaders) {
        for (const { name, value, options } of _cookiesToSet) {
          setCookie(name, value, options);
        }
        // Aplica headers de resposta retornados pelo Supabase
        for (const [key, value] of Object.entries(responseHeaders)) {
          setResponseHeader(key, value);
        }
      },
    },
  });

  try {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return { userId: data.user.id };
  } catch {
    return null;
  }
}