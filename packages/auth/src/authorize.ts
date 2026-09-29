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

/** Mutações globais de White Label nunca usam o conceito amplo de platform staff. */
export function canManageWhiteLabels(roles: RoleSet): boolean {
  return hasAny(roles.platformRoles, ["platform_owner", "platform_admin"]);
}

/** Control (/control): qualquer membership válida no tenant. */
export function canAccessTenantControl(roles: RoleSet): boolean {
  return (roles.tenantRoles?.length ?? 0) > 0;
}

/** Gestão de lojistas no /control: somente owner/admin da White Label. */
export function canManageTenantStores(roles: RoleSet): boolean {
  return hasAny(roles.tenantRoles, ["tenant_owner", "tenant_admin"]);
}

/** Gestão de equipe no /control: reutiliza o mesmo boundary owner/admin do tenant. */
export function canManageTenantTeam(roles: RoleSet): boolean {
  return hasAny(roles.tenantRoles, ["tenant_owner", "tenant_admin"]);
}

/** Gestão de gateways no /control: mesmo boundary administrativo do tenant. */
export function canManageTenantGateways(roles: RoleSet): boolean {
  return hasAny(roles.tenantRoles, ["tenant_owner", "tenant_admin"]);
}

/** Admin da loja (/admin): owner/admin/manager. */
export function canAccessStoreAdmin(roles: RoleSet): boolean {
  return hasAny(roles.storeRoles, ["store_owner", "store_admin", "store_manager"]);
}

export function assertCanAccessMaster(roles: RoleSet): void {
  if (!canAccessMaster(roles)) throw new AuthorizationError("Requer platform_owner/admin");
}

export function assertCanManageWhiteLabels(roles: RoleSet): void {
  if (!canManageWhiteLabels(roles)) {
    throw new AuthorizationError("Mutações de White Label requerem platform_owner/admin");
  }
}

export function assertCanAccessTenantControl(roles: RoleSet): void {
  if (!canAccessTenantControl(roles)) throw new AuthorizationError("Requer membership no tenant");
}

export function assertCanManageTenantStores(roles: RoleSet): void {
  if (!canManageTenantStores(roles)) {
    throw new AuthorizationError("Gestão de lojistas requer tenant_owner/admin");
  }
}

export function assertCanManageTenantTeam(roles: RoleSet): void {
  if (!canManageTenantTeam(roles)) {
    throw new AuthorizationError("Gestão de equipe requer tenant_owner/admin");
  }
}

export function assertCanManageTenantGateways(roles: RoleSet): void {
  if (!canManageTenantGateways(roles)) {
    throw new AuthorizationError("Gestão de gateways requer tenant_owner/admin");
  }
}

export function assertCanAccessStoreAdmin(roles: RoleSet): void {
  if (!canAccessStoreAdmin(roles)) throw new AuthorizationError("Requer store_owner/admin/manager");
}
