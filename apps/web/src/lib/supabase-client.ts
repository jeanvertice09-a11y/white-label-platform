// Client BROWSER: integração SSR real com @supabase/ssr.
// Usa createBrowserClient para gerenciar cookies corretamente (refresh, persistência).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Client BROWSER: somente anon key (VITE_*). Service role jamais entra aqui.
// Sem env válida não há client fake: falha explícita (fail closed).
function readPublicEnv(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("[supabase-client] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes");
  }
  return { url, anonKey };
}

let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") throw new Error("[supabase-client] Uso exclusivo no browser");
  if (!cached) {
    const { url, anonKey } = readPublicEnv();
    cached = createBrowserClient(url, anonKey);
  }
  return cached;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getBrowserClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await getBrowserClient().auth.signOut();
  if (error) throw new Error(error.message);
}