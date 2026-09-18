import { normalizeAndValidateHostname } from "./normalize.ts";

function invalidInput(message: string): never {
  throw new Error(`Hostname inválido: ${message}`);
}

/**
 * Entrada administrativa para cadastro/edição de domínio.
 * Aceita hostname puro ou URL http(s) sem path/query/hash/porta.
 */
export function normalizeDomainRegistrationInput(input: string): string {
  const raw = input.trim();
  if (!raw) return invalidInput("valor vazio");

  const httpMatch = /^(https?):\/\/([^/?#]+)(.*)$/i.exec(raw);
  if (httpMatch) {
    const authority = httpMatch[2] ?? "";
    const suffix = httpMatch[3] ?? "";
    if (authority.includes("@")) return invalidInput("credenciais não são permitidas");
    if (authority.includes(":")) return invalidInput("porta não é permitida");
    if (suffix !== "" && suffix !== "/") return invalidInput("path, query ou fragment não são permitidos");
    try {
      return normalizeAndValidateHostname(new URL(raw).hostname);
    } catch {
      return invalidInput(raw);
    }
  }

  if (raw.includes("://")) return invalidInput("protocolo não suportado");
  if (/[/?#]/.test(raw)) return invalidInput("path, query ou fragment não são permitidos");
  if (raw.includes(":")) return invalidInput("porta não é permitida");
  return normalizeAndValidateHostname(raw);
}
