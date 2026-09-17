// scripts/bootstrap-platform-owner.ts — operador local, SERVER-ONLY.
// Promove TARGET_USER_ID a platform_owner usando service role LOCAL.
// Nunca importar no web. Recusa placeholders e ambiente production sem CONFIRM.
export {};

const g = globalThis as Record<string, unknown>;
if (typeof g["window"] !== "undefined") throw new Error("server-only");

const url = process.env["SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const target = process.env["TARGET_USER_ID"];
const appEnv = process.env["APP_ENV"] ?? "local";
const confirmProd = process.env["CONFIRM_PRODUCTION"];

if (!url || !serviceKey) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
if (!target || target.includes("EXAMPLE") || target.length < 10) {
  throw new Error("TARGET_USER_ID inválido (auth.uid() real exigido)");
}
if (serviceKey.includes("EXAMPLE")) throw new Error("service key de exemplo recusada");
if (appEnv === "production" && confirmProd !== "YES") {
  throw new Error("Produção exige CONFIRM_PRODUCTION=YES + change control");
}

const res = await fetch(`${url}/rest/v1/platform_members`, {
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
console.warn(`[bootstrap] platform_owner registrado para ${target} em ${appEnv}`);
