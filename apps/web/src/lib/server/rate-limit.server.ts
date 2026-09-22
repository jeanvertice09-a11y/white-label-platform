import type { SqlExecutor } from "@white-label/domains";

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(message = "Muitas tentativas. Tente novamente em instantes.") {
    super(message);
  }
}

const RATE_KEY = /^[a-z0-9:_-]{3,200}$/;

export async function enforceRateLimit(
  sql: SqlExecutor,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  if (!RATE_KEY.test(key)) throw new Error("Chave de rate limit inválida.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("Limite inválido.");
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) throw new Error("Janela inválida.");
  const rows = await sql.query(
    "select public.consume_security_rate_limit($1,$2::int,$3::int) as allowed",
    [key, limit, windowSeconds],
  );
  if (rows.at(0)?.["allowed"] !== true) throw new RateLimitError();
}
