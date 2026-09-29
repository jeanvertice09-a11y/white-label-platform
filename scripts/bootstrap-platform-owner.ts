// scripts/bootstrap-platform-owner.ts — CLI do operador local, SERVER-ONLY.
// Nunca importar no web. Uso: TARGET_USER_ID=<auth.uid> bun scripts/bootstrap-platform-owner.ts
import { runBootstrap } from "./bootstrap.ts";

export {};

const g = globalThis as Record<string, unknown>;
if (typeof g["window"] !== "undefined") throw new Error("server-only");

const result = await runBootstrap(
  {
    SUPABASE_URL: process.env["SUPABASE_URL"],
    SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
    TARGET_USER_ID: process.env["TARGET_USER_ID"],
    APP_ENV: process.env["APP_ENV"],
    CONFIRM_PRODUCTION: process.env["CONFIRM_PRODUCTION"],
  },
  fetch,
);
console.warn(`[bootstrap] platform_owner registrado para ${result.targetUserId} em ${result.appEnv}`);
