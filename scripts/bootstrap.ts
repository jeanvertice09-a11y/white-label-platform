// Lógica do bootstrap separada do CLI p/ ser testável sem rede.
// Server-only por contrato (nunca importar no web); o guard de window vive
// no CLI. Idempotente via upsert (merge-duplicates).
export interface BootstrapEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TARGET_USER_ID?: string;
  APP_ENV?: string;
  CONFIRM_PRODUCTION?: string;
}

export interface BootstrapFetch {
  (url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<{
    ok: boolean;
    status: number;
  }>;
}

export interface BootstrapResult {
  url: string;
  targetUserId: string;
  appEnv: string;
}

export function validateBootstrapEnv(env: BootstrapEnv): { url: string; serviceKey: string; target: string; appEnv: string } {
  const url = env["SUPABASE_URL"];
  const serviceKey = env["SUPABASE_SERVICE_ROLE_KEY"];
  const target = env["TARGET_USER_ID"];
  const appEnv = env["APP_ENV"] ?? "local";
  if (!url || !serviceKey) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
  if (!target || target.includes("EXAMPLE") || target.length < 10) {
    throw new Error("TARGET_USER_ID inválido (auth.uid() real exigido)");
  }
  if (serviceKey.includes("EXAMPLE")) throw new Error("service key de exemplo recusada");
  if (appEnv === "production" && env["CONFIRM_PRODUCTION"] !== "YES") {
    throw new Error("Produção exige CONFIRM_PRODUCTION=YES + change control");
  }
  return { url, serviceKey, target, appEnv };
}

export async function runBootstrap(env: BootstrapEnv, doFetch: BootstrapFetch): Promise<BootstrapResult> {
  const { url, serviceKey, target, appEnv } = validateBootstrapEnv(env);
  const res = await doFetch(`${url}/rest/v1/platform_members`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: target, role: "platform_owner" }),
  });
  if (!res.ok) throw new Error(`bootstrap falhou: ${String(res.status)}`);
  return { url, targetUserId: target, appEnv };
}
