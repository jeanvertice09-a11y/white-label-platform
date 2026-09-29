// Normalização segura de hostname: lowercase, sem porta, sem trailing dot.
export function normalizeHostname(input: string): string {
  let host = input.trim().toLowerCase();
  // Remove esquema acidental (http://x -> x) sem validar URL externa aqui.
  const schemeIdx = host.indexOf("://");
  if (schemeIdx >= 0) host = host.slice(schemeIdx + 3);
  // Remove path/query.
  const slash = host.indexOf("/");
  if (slash >= 0) host = host.slice(0, slash);
  // Remove porta.
  const colon = host.lastIndexOf(":");
  if (colon >= 0 && host.indexOf("]") < colon) {
    host = host.slice(0, colon);
  }
  // Trailing dot (FQDN).
  if (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;

export function isValidHostname(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  if (host === "localhost") return true;
  return HOST_RE.test(host);
}

export function normalizeAndValidateHostname(input: string): string {
  const host = normalizeHostname(input);
  if (!isValidHostname(host)) throw new Error(`Hostname inválido: ${input}`);
  return host;
}
