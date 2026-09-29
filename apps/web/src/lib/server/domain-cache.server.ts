import { InMemoryDomainCache, type DomainCache } from "@white-label/domains";

const domainCache = new InMemoryDomainCache();

export function getDomainCache(): DomainCache {
  return domainCache;
}
