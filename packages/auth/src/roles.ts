export type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_support"
  | "platform_finance";

export type TenantRole =
  | "tenant_owner"
  | "tenant_admin"
  | "tenant_finance"
  | "tenant_support";

export type StoreRole =
  | "store_owner"
  | "store_admin"
  | "store_manager"
  | "store_staff";

export const PLATFORM_ROLES: readonly PlatformRole[] = [
  "platform_owner",
  "platform_admin",
  "platform_support",
  "platform_finance",
];

export const TENANT_ROLES: readonly TenantRole[] = [
  "tenant_owner",
  "tenant_admin",
  "tenant_finance",
  "tenant_support",
];

export const STORE_ROLES: readonly StoreRole[] = [
  "store_owner",
  "store_admin",
  "store_manager",
  "store_staff",
];
