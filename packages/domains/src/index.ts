export { normalizeHostname, isValidHostname, normalizeAndValidateHostname } from "./normalize.ts";
export { normalizeDomainRegistrationInput } from "./registration.ts";
export { assertAllowedCustomHostname, isReservedKataluuHostname, RESERVED_KATALUU_SUBDOMAINS } from "./policy.ts";
export { DnsDomainProvider, verificationTxtHostname } from "./onboarding.ts";
export type { DnsInstruction, DomainDnsPlan, DomainVerificationResult, DomainChallenge, DnsLookup, DomainProvider } from "./onboarding.ts";
export { DomainResolver, InMemoryDomainCache, UNTRUSTED_TENANT_HEADERS } from "./resolver.ts";
export type { DomainRecord, DomainStore, DomainCache, DomainStatus, DomainType, ResolvedDomain } from "./resolver.ts";
export { PostgresDomainStore } from "./postgres.ts";
export type { SqlExecutor } from "./postgres.ts";
export {
  KATALUU_MANAGED_DOMAIN_ROOT,
  isManagedKataluuHostname,
  normalizeManagedKataluuHostname,
} from "./provisioning.ts";
export type {
  EnsureProjectDomainResult,
  ManagedDomainProvisioner,
  ProjectDomainState,
} from "./provisioning.ts";
