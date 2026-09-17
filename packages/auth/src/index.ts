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
  assertCanAccessMaster,
  assertCanAccessTenantControl,
  assertCanAccessStoreAdmin,
} from "./authorize.ts";
export type { RoleSet } from "./authorize.ts";
