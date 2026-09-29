import type { PlatformRole } from "@white-label/auth";

export function isPlatformStaff(roles: PlatformRole[]): boolean {
  return roles.length > 0;
}

export function isPlatformOwner(roles: PlatformRole[]): boolean {
  return roles.includes("platform_owner");
}
