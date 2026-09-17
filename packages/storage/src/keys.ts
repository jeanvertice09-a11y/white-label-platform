import { randomUUID } from "node:crypto";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** Key canônica: tenants/{t}/stores/{s}/... — sempre gerada no servidor. */
export function buildObjectKey(args: {
  tenantId: string;
  storeId?: string;
  kind: "product" | "category" | "brand" | "misc";
  extension: string;
}): string {
  const ext = args.extension.toLowerCase().replace(/^\./, "").slice(0, 10);
  if (!/^[a-z0-9]{1,10}$/.test(ext)) throw new Error("Extensão inválida");
  const base = `tenants/${slug(args.tenantId)}`;
  const scope = args.storeId ? `${base}/stores/${slug(args.storeId)}` : base;
  return `${scope}/${args.kind}/${randomUUID()}.${ext}`;
}

/** Rejeita key fora do prefixo do tenant (defesa em profundidade). */
export function assertKeyBelongsToTenant(objectKey: string, tenantId: string): void {
  const prefix = `tenants/${tenantId.toLowerCase()}`;
  if (!objectKey.toLowerCase().startsWith(prefix)) {
    throw new Error("Object key fora do tenant");
  }
}
