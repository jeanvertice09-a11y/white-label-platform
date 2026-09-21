import { normalizeAndValidateHostname } from "./normalize.ts";
import { assertAllowedCustomHostname } from "./policy.ts";

export const KATALUU_MANAGED_DOMAIN_ROOT = "kataluu.com.br";

export interface ProjectDomainState {
  hostname: string;
  provisioned: boolean;
  verified: boolean | null;
  projectId: string | null;
}

export interface EnsureProjectDomainResult extends ProjectDomainState {
  action: "created" | "already_provisioned";
}

export interface ManagedDomainProvisioner {
  getProjectDomainState(hostname: string): Promise<ProjectDomainState>;
  ensureProjectDomain(hostname: string): Promise<EnsureProjectDomainResult>;
}

function invalidManagedHostname(message: string): never {
  throw new Error(`Hostname Kataluu inválido: ${message}`);
}

/**
 * Boundary estrito do provisionamento de infraestrutura da Vercel.
 * Diferente do input administrativo geral, aceita somente hostname puro
 * e somente subdomínios não reservados sob kataluu.com.br.
 */
export function normalizeManagedKataluuHostname(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) return invalidManagedHostname("valor vazio");
  if (raw.includes("://")) return invalidManagedHostname("protocolo não é permitido");
  if (/[/?#]/.test(raw)) return invalidManagedHostname("path, query ou fragment não são permitidos");
  if (raw.includes(":")) return invalidManagedHostname("porta não é permitida");

  const hostname = assertAllowedCustomHostname(normalizeAndValidateHostname(raw));
  if (hostname === KATALUU_MANAGED_DOMAIN_ROOT || !hostname.endsWith(`.${KATALUU_MANAGED_DOMAIN_ROOT}`)) {
    return invalidManagedHostname(`fora da zona ${KATALUU_MANAGED_DOMAIN_ROOT}`);
  }
  return hostname;
}

export function isManagedKataluuHostname(input: string): boolean {
  try {
    normalizeManagedKataluuHostname(input);
    return true;
  } catch {
    return false;
  }
}
