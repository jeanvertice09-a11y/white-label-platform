import { normalizeAndValidateHostname } from "./normalize.ts";

export type DomainType = "tenant_panel" | "tenant_site" | "store_admin" | "store_catalog";
export type DomainStatus = "pending" | "active" | "suspended";

export interface DomainRecord {
  id: string;
  tenantId: string;
  storeId: string | null;
  hostname: string;
  type: DomainType;
  status: DomainStatus;
  verifiedAt: string | null;
}

export interface ResolvedDomain {
  tenantId: string;
  storeId: string | null;
  type: DomainType;
}

export interface DomainStore {
  findByHostname(hostname: string): Promise<DomainRecord | null>;
}

/** Cache desacoplado (futura implementação Cloudflare KV/edge). */
export interface DomainCache {
  get(hostname: string): Promise<ResolvedDomain | null>;
  set(hostname: string, value: ResolvedDomain, ttlSeconds: number): Promise<void>;
  del(hostname: string): Promise<void>;
}

export class InMemoryDomainCache implements DomainCache {
  private map = new Map<string, { value: ResolvedDomain; exp: number }>();
  async get(hostname: string): Promise<ResolvedDomain | null> {
    await Promise.resolve();
    const e = this.map.get(hostname);
    if (!e || e.exp < Date.now()) return null;
    return e.value;
  }
  async set(hostname: string, value: ResolvedDomain, ttlSeconds: number): Promise<void> {
    await Promise.resolve();
    this.map.set(hostname, { value, exp: Date.now() + ttlSeconds * 1000 });
  }
  async del(hostname: string): Promise<void> {
    await Promise.resolve();
    this.map.delete(hostname);
  }
}

export class DomainResolver {
  constructor(
    private readonly store: DomainStore,
    private readonly cache?: DomainCache,
  ) {}

  /** Resolve Host -> tenant/store. Somente domínios active verificados. */
  async resolve(rawHost: string): Promise<ResolvedDomain | null> {
    const hostname = normalizeAndValidateHostname(rawHost);
    if (this.cache) {
      const hit = await this.cache.get(hostname);
      if (hit) return hit;
    }
    const rec = await this.store.findByHostname(hostname);
    if (!rec || rec.status !== "active" || rec.verifiedAt === null) return null;
    const out: ResolvedDomain = { tenantId: rec.tenantId, storeId: rec.storeId, type: rec.type };
    if (this.cache) await this.cache.set(hostname, out, 300);
    return out;
  }
}

// Fronteira de confiança: header interno só vale se a borda removeu o externo.
// Nesta fase NENHUM header externo é aceito como autoridade.
export const UNTRUSTED_TENANT_HEADERS = ["x-resolved-tenant-id", "x-tenant-id"] as const;
