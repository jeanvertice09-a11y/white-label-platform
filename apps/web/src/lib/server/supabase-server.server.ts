// SERVER-ONLY: cliente Supabase SSR autenticado pelo cookie do request.
import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import type { AuthenticatorAssuranceLevel, Session } from "./session.server.ts";

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
  if (!url || !anonKey) {
    throw new Error("[supabase-server] SUPABASE_URL/ANON_KEY ausentes");
  }
  return { url, anonKey };
}

function normalizeAssuranceLevel(value: unknown): AuthenticatorAssuranceLevel | null {
  return value === "aal1" || value === "aal2" ? value : null;
}

export function createRequestSupabaseClient() {
  const { url, anonKey } = readServerEnv();
  setResponseHeader("Cache-Control", "private, no-store");
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const cookies = getCookies();
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet, responseHeaders) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
        for (const [key, value] of Object.entries(responseHeaders)) {
          setResponseHeader(key, value);
        }
      },
    },
  });
}

/** Valida o JWT e o nível MFA da sessão contra o Supabase Auth. */
export async function validateServerSession(): Promise<Session | null> {
  assertServer();
  const client = createRequestSupabaseClient();
  try {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) {
      return { userId: data.user.id, assuranceLevel: null, nextAssuranceLevel: null };
    }
    return {
      userId: data.user.id,
      assuranceLevel: normalizeAssuranceLevel(assurance.data.currentLevel),
      nextAssuranceLevel: normalizeAssuranceLevel(assurance.data.nextLevel),
    };
  } catch {
    return null;
  }
}
