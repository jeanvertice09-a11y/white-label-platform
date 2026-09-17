import { randomUUID } from "node:crypto";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export type StorageKind =
  | "product"
  | "variant"
  | "category"
  | "banner"
  | "logo"
  | "catalog"
  | "brand"
  | "misc";

/** Key canônica: tenants/{t}/stores/{s}/... — sempre gerada no servidor. */
export function buildObjectKey(args: {
  tenantId: string;
  storeId?: string;
  kind: StorageKind;
  extension: string;
}): string {
  const ext = args.extension.toLowerCase().replace(/^\./, "").slice(0, 10);
  if (!/^[a-z0-9]{1,10}$/.test(ext)) throw new Error("Extensão inválida");
  const tenant = slug(args.tenantId);
  if (!tenant) throw new Error("tenantId inválido");
  const base = `tenants/${tenant}`;
  const store = args.storeId ? slug(args.storeId) : null;
  if (args.storeId && !store) throw new Error("storeId inválido");
  const scope = store ? `${base}/stores/${store}` : base;
  return `${scope}/${args.kind}/${randomUUID()}.${ext}`;
}

export function assertKeyBelongsToTenant(objectKey: string, tenantId: string): void {
  const prefix = `tenants/${slug(tenantId)}/`;
  if (!objectKey.toLowerCase().startsWith(prefix)) {
    throw new Error("Object key fora do tenant");
  }
}

export function assertKeyBelongsToStore(
  objectKey: string,
  tenantId: string,
  storeId: string,
): void {
  const prefix = `tenants/${slug(tenantId)}/stores/${slug(storeId)}/`;
  if (!objectKey.toLowerCase().startsWith(prefix)) {
    throw new Error("Object key fora da store");
  }
}
