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
  canManageTenantGateways,
  assertCanAccessMaster,
  assertCanAccessTenantControl,
  assertCanAccessStoreAdmin,
  assertCanManageWhiteLabels,
  assertCanManageTenantStores,
  assertCanManageTenantGateways,
} from "./authorize.ts";
export type { RoleSet } from "./authorize.ts";
