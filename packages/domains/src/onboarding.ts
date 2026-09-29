import { normalizeHostname, normalizeAndValidateHostname } from "./normalize.ts";

export interface DnsInstruction { type: "CNAME" | "TXT"; host: string; value: string }
export interface DomainDnsPlan { available: boolean; message: string; records: DnsInstruction[] }
export interface DomainVerificationResult {
  configured: boolean;
  verified: boolean;
  reason: string;
  checkedAt: string;
  evidence: { cnameMatches: boolean; txtMatches: boolean };
}
export interface DomainChallenge { hostname: string; verificationToken: string }
export interface DnsLookup {
  resolveCname(hostname: string): Promise<string[]>;
  resolveTxt(hostname: string): Promise<string[][]>;
}
export interface DomainProvider {
  readonly name: string;
  readonly configured: boolean;
  getDnsInstructions(challenge: DomainChallenge): DomainDnsPlan;
  verifyDomain(challenge: DomainChallenge): Promise<DomainVerificationResult>;
}

export function verificationTxtHostname(hostname: string): string {
  return `_kataluu-verification.${normalizeAndValidateHostname(hostname)}`;
}

async function safeCname(dns: DnsLookup, hostname: string): Promise<string[]> {
  try { return await dns.resolveCname(hostname); } catch { return []; }
}
async function safeTxt(dns: DnsLookup, hostname: string): Promise<string[][]> {
  try { return await dns.resolveTxt(hostname); } catch { return []; }
}

export class DnsDomainProvider implements DomainProvider {
  readonly name = "dns";
  readonly configured: boolean;
  private readonly target: string | null;

  constructor(target: string | null, private readonly dns: DnsLookup) {
    const value = target?.trim() ?? "";
    this.target = value ? normalizeAndValidateHostname(value) : null;
    this.configured = this.target !== null;
  }

  getDnsInstructions(challenge: DomainChallenge): DomainDnsPlan {
    if (!this.target) return { available: false, message: "Configuração de domínio da plataforma não disponível.", records: [] };
    const hostname = normalizeAndValidateHostname(challenge.hostname);
    return {
      available: true,
      message: "Configure os dois registros e depois solicite a verificação.",
      records: [
        { type: "CNAME", host: hostname, value: this.target },
        { type: "TXT", host: verificationTxtHostname(hostname), value: challenge.verificationToken },
      ],
    };
  }

  async verifyDomain(challenge: DomainChallenge): Promise<DomainVerificationResult> {
    const checkedAt = new Date().toISOString();
    if (!this.target) return { configured: false, verified: false, reason: "Configuração de domínio da plataforma não disponível.", checkedAt, evidence: { cnameMatches: false, txtMatches: false } };
    const hostname = normalizeAndValidateHostname(challenge.hostname);
    const [cnames, txtRows] = await Promise.all([
      safeCname(this.dns, hostname),
      safeTxt(this.dns, verificationTxtHostname(hostname)),
    ]);
    const cnameMatches = cnames.some((value) => normalizeHostname(value) === this.target);
    const txtMatches = txtRows.some((parts) => parts.join("").trim() === challenge.verificationToken);
    const verified = cnameMatches && txtMatches;
    return {
      configured: true,
      verified,
      reason: verified ? "DNS confirmado por CNAME e TXT." : "DNS ainda não corresponde aos registros exigidos.",
      checkedAt,
      evidence: { cnameMatches, txtMatches },
    };
  }
}
