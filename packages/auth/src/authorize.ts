import type { PlatformRole, StoreRole, TenantRole } from "./roles.ts";

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Acesso negado") {
    super(message);
  }
}

export interface RoleSet {
  platformRoles?: PlatformRole[];
  tenantRoles?: TenantRole[];
  storeRoles?: StoreRole[];
}

function hasAny<T>(have: readonly T[] | undefined, need: readonly T[]): boolean {
  if (!have) return false;
  return need.some((r) => have.includes(r));
}

export function requirePlatformRole(roles: RoleSet, ...allowed: PlatformRole[]): void {
  if (!hasAny(roles.platformRoles, allowed)) throw new AuthorizationError();
}

export function requireTenantRole(roles: RoleSet, ...allowed: TenantRole[]): void {
  if (!hasAny(roles.tenantRoles, allowed)) throw new AuthorizationError();
}

export function requireStoreRole(roles: RoleSet, ...allowed: StoreRole[]): void {
  if (!hasAny(roles.storeRoles, allowed)) throw new AuthorizationError();
}

/** Master (/master): somente platform owner/admin. */
export function canAccessMaster(roles: RoleSet): boolean {
  return hasAny(roles.platformRoles, ["platform_owner", "platform_admin"]);
}

/** Control (/control): qualquer membership válida no tenant. */
export function canAccessTenantControl(roles: RoleSet): boolean {
  return (roles.tenantRoles?.length ?? 0) > 0;
}

/** Admin da loja (/admin): owner/admin/manager. */
export function canAccessStoreAdmin(roles: RoleSet): boolean {
  return hasAny(roles.storeRoles, ["store_owner", "store_admin", "store_manager"]);
}

export function assertCanAccessMaster(roles: RoleSet): void {
  if (!canAccessMaster(roles)) throw new AuthorizationError("Requer platform_owner/admin");
}

export function assertCanAccessTenantControl(roles: RoleSet): void {
  if (!canAccessTenantControl(roles)) throw new AuthorizationError("Requer membership no tenant");
}

export function assertCanAccessStoreAdmin(roles: RoleSet): void {
  if (!canAccessStoreAdmin(roles)) throw new AuthorizationError("Requer store_owner/admin/manager");
}
