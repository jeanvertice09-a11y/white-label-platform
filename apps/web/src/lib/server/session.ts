// SERVER-ONLY: resolução de sessão a partir do request.
// Falha se importado em bundle client (window presente).
// Integração real com Supabase Auth: PENDENTE (aguardando projeto local).
// Até lá, NENHUMA sessão é fabricada: retorna null -> rotas negam (fail closed).

export interface Session {
  userId: string;
}

function assertServer(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error("[server/session] Módulo server-only vazou para o client.");
  }
}

/**
 * Extrai sessão do cookie do request.
 * Hoje: sempre null (sem JWT validado não há identidade).
 * Integração futura: validar JWT do Supabase (sb-*-auth-token) aqui.
 */
export function getSessionFromCookieHeader(_cookieHeader: string | null): Session | null {
  assertServer();
  return null;
}

/** Injeção p/ testes da matriz de autorização (não usada em produção). */
export function stubSession(userId: string): Session {
  return { userId };
}
