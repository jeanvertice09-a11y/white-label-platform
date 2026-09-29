// Módulo SERVER-ONLY: service role jamais chega ao browser.
// Qualquer import deste arquivo em bundle client deve falhar no build/lint.
//
// Uso permitido: apps/worker, server functions, scripts internos.
// Uso proibido: componentes React client, código com prefixo VITE_, edge público.

function assertServerOnly(): void {
  // Vite/bundlers client definem `window`; worker/Node não.
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error(
      "[auth/server] SUPABASE_SERVICE_ROLE_KEY não pode ser usado no browser. Import server-only vazou para o client.",
    );
  }
}

export interface ServiceRoleConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

export function getServiceRoleConfig(env: Record<string, string | undefined>): ServiceRoleConfig {
  assertServerOnly();
  const supabaseUrl = env["SUPABASE_URL"];
  const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl) throw new Error("[auth/server] SUPABASE_URL ausente");
  if (!serviceRoleKey) throw new Error("[auth/server] SUPABASE_SERVICE_ROLE_KEY ausente");
  return { supabaseUrl, serviceRoleKey };
}

export function assertNoServiceRoleInPublicEnv(env: Record<string, string | undefined>): void {
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") && /SERVICE_ROLE|SECRET|PRIVATE/i.test(key)) {
      throw new Error(`[auth/server] Segredo exposto em env pública: ${key}`);
    }
  }
}
