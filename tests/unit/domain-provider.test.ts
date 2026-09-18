import { describe, expect, test } from "bun:test";
import { DnsDomainProvider, verificationTxtHostname, type DnsLookup } from "@white-label/domains";

function dns(cnames: string[], txt: string[][]): DnsLookup {
  return {
    async resolveCname() { return Promise.resolve(cnames); },
    async resolveTxt() { return Promise.resolve(txt); },
  };
}

const challenge = { hostname: "loja.exemplo.com", verificationToken: "challenge-public-value" };

describe("DNS domain provider", () => {
  test("provider indisponível não inventa instrução nem verificação", async () => {
    const provider = new DnsDomainProvider(null, dns([], []));
    expect(provider.getDnsInstructions(challenge).available).toBe(false);
    const result = await provider.verifyDomain(challenge);
    expect(result.configured).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("não disponível");
  });

  test("instruções usam CNAME configurado e desafio TXT", () => {
    const provider = new DnsDomainProvider("domains.kataluu.com.br", dns([], []));
    const plan = provider.getDnsInstructions(challenge);
    expect(plan.available).toBe(true);
    expect(plan.records).toEqual([
      { type: "CNAME", host: challenge.hostname, value: "domains.kataluu.com.br" },
      { type: "TXT", host: verificationTxtHostname(challenge.hostname), value: challenge.verificationToken },
    ]);
  });

  test("só verifica quando CNAME e TXT reais correspondem", async () => {
    const provider = new DnsDomainProvider(
      "domains.kataluu.com.br",
      dns(["DOMAINS.KATALUU.COM.BR."], [["challenge-", "public-value"]]),
    );
    const result = await provider.verifyDomain(challenge);
    expect(result.verified).toBe(true);
    expect(result.evidence).toEqual({ cnameMatches: true, txtMatches: true });
  });

  test("evidência parcial nunca ativa", async () => {
    const provider = new DnsDomainProvider("domains.kataluu.com.br", dns(["domains.kataluu.com.br"], [["wrong"]]));
    const result = await provider.verifyDomain(challenge);
    expect(result.verified).toBe(false);
    expect(result.evidence.cnameMatches).toBe(true);
    expect(result.evidence.txtMatches).toBe(false);
  });
});
