import type { StoreId, TenantId, UserId } from "./branded.ts";
import type {
  PlatformRole,
  StoreRole,
  TenantRole,
} from "@white-label/auth";

/**
 * Contexto confiável resolvido no SERVIDOR.
 * Nunca construir a partir de query/body/header público.
 */
export interface TenantContext {
  userId: UserId;
  tenantId: TenantId;
  storeId?: StoreId;
  platformRoles: PlatformRole[];
  tenantRoles: TenantRole[];
  storeRoles: StoreRole[];
  hostname?: string;
  requestId: string;
}

export interface MembershipRow {
  tenantId: TenantId;
  storeId?: StoreId;
  tenantRoles: TenantRole[];
  storeRoles: StoreRole[];
}

export interface ResolveInput {
  userId: UserId;
  platformRoles: PlatformRole[];
  memberships: MembershipRow[];
  /** Tenant selecionado internamente (sessão/membership), nunca body cru. */
  activeTenantId: TenantId;
  activeStoreId?: StoreId;
  hostname?: string;
  requestId: string;
}

export class TenantContextError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Resolve o contexto validando membership — rejeita tenant/store sem vínculo. */
export function resolveTenantContext(input: ResolveInput): TenantContext {
  if (!input.requestId) {
    throw new TenantContextError("REQUEST_ID_REQUIRED", "requestId é obrigatório");
  }
  const tenantRows = input.memberships.filter((m) => m.tenantId === input.activeTenantId);
  if (tenantRows.length === 0) {
    throw new TenantContextError("TENANT_FORBIDDEN", "Usuário sem membership neste tenant");
  }
  if (input.activeStoreId !== undefined) {
    // Acesso a store exige membership EXPLÍCITA naquela store:
    // role de outra store jamais autoriza.
    const storeRow = tenantRows.find((m) => m.storeId === input.activeStoreId);
    if (!storeRow || storeRow.storeRoles.length === 0) {
      throw new TenantContextError("STORE_FORBIDDEN", "Usuário sem acesso a esta store");
    }
    const first = tenantRows[0];
    return {
      userId: input.userId,
      tenantId: input.activeTenantId,
      storeId: input.activeStoreId,
      platformRoles: input.platformRoles,
      tenantRoles: first.tenantRoles,
      storeRoles: storeRow.storeRoles,
      hostname: input.hostname,
      requestId: input.requestId,
    };
  }
  const first = tenantRows[0];
  return {
    userId: input.userId,
    tenantId: first.tenantId,
    storeId: undefined,
    platformRoles: input.platformRoles,
    tenantRoles: first.tenantRoles,
    storeRoles: [],
    hostname: input.hostname,
    requestId: input.requestId,
  };
}

/**
 * Garante que um recurso pertence ao tenant do contexto.
 * Camada de aplicação: banco (FK composta + RLS) é a segunda barreira.
 */
export function assertSameTenant(ctx: TenantContext, resourceTenantId: TenantId): void {
  if (ctx.tenantId !== resourceTenantId) {
    throw new TenantContextError("CROSS_TENANT_DENIED", "Acesso cross-tenant negado");
  }
}

export function assertSameStore(ctx: TenantContext, resourceStoreId: StoreId): void {
  if (ctx.storeId === undefined || ctx.storeId !== resourceStoreId) {
    throw new TenantContextError("CROSS_STORE_DENIED", "Acesso cross-store negado");
  }
}
