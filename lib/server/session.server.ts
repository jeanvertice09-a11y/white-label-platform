// SERVER-ONLY: resolução de sessão a partir do request.
// Falha se importado em bundle client (window presente).
// Sessão REAL: JWT validado contra o Supabase Auth no servidor
// (validateServerSession). Sem backend/sessão -> null -> rotas negam.

import { validateServerSession } from "./supabase-server.server.ts";

export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

export interface Session {
  userId: string;
  assuranceLevel: AuthenticatorAssuranceLevel | null;
  nextAssuranceLevel: AuthenticatorAssuranceLevel | null;
}

function assertServer(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error("[server/session] Módulo server-only vazou para o client.");
  }
}

/** Resolve sessão via Supabase Auth server-side. Nunca fabrica identidade. */
export async function resolveSessionFromRequest(): Promise<Session | null> {
  assertServer();
  return validateServerSession();
}

/** Injeção p/ testes da matriz de autorização (não usada em produção). */
export function stubSession(
  userId: string,
  assuranceLevel: AuthenticatorAssuranceLevel = "aal2",
): Session {
  return { userId, assuranceLevel, nextAssuranceLevel: assuranceLevel };
}
