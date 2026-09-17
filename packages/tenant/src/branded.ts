// Branded IDs: impedem troca acidental de tenant/store/user no código.
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type TenantId = Brand<string, "TenantId">;
export type StoreId = Brand<string, "StoreId">;
export type UserId = Brand<string, "UserId">;
export type ProductId = Brand<string, "ProductId">;
export type OrderId = Brand<string, "OrderId">;
export type DomainId = Brand<string, "DomainId">;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function brand<B extends string>(kind: B, value: string): Brand<string, B> {
  if (!isUuid(value)) throw new Error(`${kind} inválido (UUID esperado)`);
  return value as Brand<string, B>;
}

export function asTenantId(value: string): TenantId {
  return brand("TenantId", value);
}

export function asStoreId(value: string): StoreId {
  return brand("StoreId", value);
}

export function asUserId(value: string): UserId {
  return brand("UserId", value);
}

export function asProductId(value: string): ProductId {
  return brand("ProductId", value);
}

export function asOrderId(value: string): OrderId {
  return brand("OrderId", value);
}
