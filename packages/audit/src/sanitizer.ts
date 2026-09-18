export interface AuditEntry {
  id?: string;
  actorUserId: string | null;
  tenantId: string | null;
  storeId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

const SECRET_KEYS = [
  "password",
  "passwd",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "webhook_secret",
  "client_secret",
  "secret",
  "token",
  "credential",
  "credentials",
];

function isSecretKey(key: string): boolean {
  const k = key.toLowerCase();
  return SECRET_KEYS.some((s) => k === s || k.endsWith(`_${s}`) || k.endsWith(`-${s}`));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) ? "[REDACTED]" : sanitizeValue(v);
    }
    return out;
  }
  return value;
}

/** Remove segredos de metadata/logs antes de persistir. */
export function sanitizeAuditMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return meta;
  return sanitizeValue(meta) as Record<string, unknown>;
}

export function buildAuditEntry(input: AuditEntry): AuditEntry {
  return {
    ...input,
    metadata: sanitizeAuditMetadata(input.metadata),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
