export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  storeId?: string;
  userId?: string;
  module: string;
  event: string;
}

type Fields = Record<string, unknown>;

function redact(key: string, value: unknown): unknown {
  if (/token|secret|password|authorization|cookie|api.?key/i.test(key)) return "[REDACTED]";
  return value;
}

function clean(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) out[k] = redact(k, v);
  return out;
}

export function log(level: LogLevel, ctx: LogContext, fields: Fields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...ctx,
    ...clean(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
}
