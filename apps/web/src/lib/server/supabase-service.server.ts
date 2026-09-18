// SERVER-ONLY: cliente administrativo Supabase via HTTPS para workloads serverless.
// A service role nunca é exposta ao navegador.
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

function assertServer(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error("[supabase-service] Módulo server-only vazou para o client.");
  }
}

function readServiceEnv(): { url: string; serviceRoleKey: string } {
  assertServer();
  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRoleKey) {
    throw new Error("[supabase-service] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
  }
  return { url, serviceRoleKey };
}

let cachedClient: SupabaseClient | null = null;

export function createServiceSupabaseClient(): SupabaseClient {
  assertServer();
  if (!cachedClient) {
    const { url, serviceRoleKey } = readServiceEnv();
    cachedClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return cachedClient;
}
