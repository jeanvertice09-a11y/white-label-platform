// Rate limit: abstração central. Sem backend externo nesta fase; o adaptador
// em memória serve SOMENTE para desenvolvimento/teste — serverless exige
// store distribuído (documentado em docs/architecture).
export interface RateLimitPolicy {
  name: "login" | "password_reset" | "public_order" | "uploads" | "webhooks" | "search";
  max: number;
  windowMs: number;
}

export const RATE_LIMIT_POLICIES: readonly RateLimitPolicy[] = [
  { name: "login", max: 10, windowMs: 60_000 },
  { name: "password_reset", max: 5, windowMs: 300_000 },
  { name: "public_order", max: 20, windowMs: 60_000 },
  { name: "uploads", max: 30, windowMs: 60_000 },
  { name: "webhooks", max: 120, windowMs: 60_000 },
  { name: "search", max: 60, windowMs: 60_000 },
];

export interface RateLimiter {
  check(key: string, policy: RateLimitPolicy): Promise<{ allowed: boolean; retryAfterMs: number }>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();
  async check(key: string, policy: RateLimitPolicy): Promise<{ allowed: boolean; retryAfterMs: number }> {
    await Promise.resolve();
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < policy.windowMs);
    const first = arr[0] as number | undefined;
    if (arr.length >= policy.max) {
      const retryAfterMs = first === undefined ? policy.windowMs : policy.windowMs - (now - first);
      return { allowed: false, retryAfterMs };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true, retryAfterMs: 0 };
  }
}
