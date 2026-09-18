import { resolveCname, resolveTxt } from "node:dns/promises";
import { DnsDomainProvider, type DomainProvider } from "@white-label/domains";

export function createConfiguredDomainProvider(): DomainProvider {
  const target = process.env["DOMAIN_CNAME_TARGET"]?.trim() || null;
  return new DnsDomainProvider(target, {
    resolveCname,
    resolveTxt,
  });
}
