import { normalizeAndValidateHostname } from "./normalize.ts";

export const RESERVED_KATALUU_SUBDOMAINS = [
  "app",
  "www",
  "admin",
  "control",
  "api",
  "media",
  "assets",
  "static",
  "auth",
  "login",
  "support",
  "billing",
] as const;

const KATALUU_ROOT = "kataluu.com.br";
const RESERVED = new Set<string>(RESERVED_KATALUU_SUBDOMAINS);

/** Reserva somente nomes internos sob kataluu.com.br. */
export function isReservedKataluuHostname(input: string): boolean {
  const hostname = normalizeAndValidateHostname(input);
  if (hostname === KATALUU_ROOT) return true;
  if (!hostname.endsWith(`.${KATALUU_ROOT}`)) return false;
  const prefix = hostname.slice(0, -(KATALUU_ROOT.length + 1));
  return prefix.split(".").some((label) => RESERVED.has(label));
}

export function assertAllowedCustomHostname(input: string): string {
  const hostname = normalizeAndValidateHostname(input);
  if (isReservedKataluuHostname(hostname)) {
    throw new Error(`Hostname reservado pela plataforma: ${hostname}`);
  }
  return hostname;
}
