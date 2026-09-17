import type { RoleSet } from "@white-label/auth";
import { assertCanAccessMaster, assertCanAccessStoreAdmin, assertCanAccessTenantControl } from "@white-label/auth";

/**
 * Fronteira de módulo (UI -> handler -> use case -> repository -> DB).
 * Componentes chamam estes guards via server function; a rota é fina e a
 * regra de negócio vive nos packages. Frontend esconder botão ≠ segurança.
 */
export function guardMaster(roles: RoleSet): void {
  assertCanAccessMaster(roles);
}

export function guardControl(roles: RoleSet): void {
  assertCanAccessTenantControl(roles);
}

export function guardStoreAdmin(roles: RoleSet): void {
  assertCanAccessStoreAdmin(roles);
}
