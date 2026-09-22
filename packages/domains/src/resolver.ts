import { normalizeAndValidateHostname } from "./normalize.ts";

export type DomainType = "tenant_panel" | "tenant_site" | "store_admin" | "store_catalog";
export type DomainStatus = "pending" | "active" | "suspended";
export const DOMAIN_CACHE_TTL_SECONDS = 300;

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

export interface CachedDomainResolution extends ResolvedDomain {
  hostname: string;
}

export interface DomainStore {
  findByHostname(hostname: string): Promise<DomainRecord | null>;
}

export interface DomainCache {
  get(hostname: string): Promise<CachedDomainResolution | null>;
  set(hostname: string, value: CachedDomainResolution, ttlSeconds: number): Promise<void>;
  del(hostname: string): Promise<void>;
}

export class InMemoryDomainCache implements DomainCache {
  private readonly map = new Map<string, { value: CachedDomainResolution; exp: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(hostname: string): Promise<CachedDomainResolution | null> {
    await Promise.resolve();
    const entry = this.map.get(hostname);
    if (!entry) return null;
    if (entry.exp <= this.now()) {
      this.map.delete(hostname);
      return null;
    }
    return entry.value;
  }

  async set(hostname: string, value: CachedDomainResolution, ttlSeconds: number): Promise<void> {
    await Promise.resolve();
    this.map.set(hostname, { value, exp: this.now() + ttlSeconds * 1000 });
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
    private readonly ttlSeconds = DOMAIN_CACHE_TTL_SECONDS,
  ) {}

  async resolve(rawHost: string): Promise<ResolvedDomain | null> {
    const hostname = normalizeAndValidateHostname(rawHost);
    const hit = await this.readCache(hostname);
    if (hit) return { tenantId: hit.tenantId, storeId: hit.storeId, type: hit.type };

    const rec = await this.store.findByHostname(hostname);
    if (!rec || rec.hostname !== hostname || rec.status !== "active" || rec.verifiedAt === null) return null;

    const cached: CachedDomainResolution = {
      hostname,
      tenantId: rec.tenantId,
      storeId: rec.storeId,
      type: rec.type,
    };
    await this.writeCache(hostname, cached);
    return { tenantId: cached.tenantId, storeId: cached.storeId, type: cached.type };
  }

  private async readCache(hostname: string): Promise<CachedDomainResolution | null> {
    if (!this.cache) return null;
    try {
      const hit = await this.cache.get(hostname);
      return hit?.hostname === hostname ? hit : null;
    } catch {
      return null;
    }
  }

  private async writeCache(hostname: string, value: CachedDomainResolution): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.set(hostname, value, this.ttlSeconds);
    } catch {
      // Cache is an optimization only. PostgreSQL resolution already succeeded.
    }
  }
}

export async function invalidateDomainCache(cache: DomainCache | undefined, rawHost: string): Promise<void> {
  if (!cache) return;
  const hostname = normalizeAndValidateHostname(rawHost);
  try {
    await cache.del(hostname);
  } catch {
    // Mutation remains authoritative in PostgreSQL; TTL bounds stale cache lifetime.
  }
}

export const UNTRUSTED_TENANT_HEADERS = ["x-resolved-tenant-id", "x-tenant-id"] as const;
