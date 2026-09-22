export type { PlatformRole, TenantRole, StoreRole } from "./roles.ts";
export { PLATFORM_ROLES, TENANT_ROLES, STORE_ROLES } from "./roles.ts";
export {
  AuthorizationError,
  requirePlatformRole,
  requireTenantRole,
  requireStoreRole,
  canAccessMaster,
  canAccessTenantControl,
  canAccessStoreAdmin,
  canManageWhiteLabels,
  canManageTenantStores,
  canManageTenantTeam,
  canManageTenantGateways,
  assertCanAccessMaster,
  assertCanAccessTenantControl,
  assertCanAccessStoreAdmin,
  assertCanManageWhiteLabels,
  assertCanManageTenantStores,
  assertCanManageTenantTeam,
  assertCanManageTenantGateways,
} from "./authorize.ts";
export type { RoleSet } from "./authorize.ts";
