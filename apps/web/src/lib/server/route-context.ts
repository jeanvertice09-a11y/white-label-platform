import {
  AuthorizationError,
  assertCanAccessMaster,
  assertCanAccessStoreAdmin,
  assertCanAccessTenantControl,
} from "@white-label/auth";
import type { PlatformRole } from "@white-label/auth";
import {
  TenantContextError,
  resolveTenantContext,
} from "@white-label/tenant";
import type { MembershipRow, TenantContext } from "@white-label/tenant";
import type { StoreId, TenantId, UserId } from "@white-label/tenant";
import { getSessionFromCookieHeader, stubSession } from "./session.ts";
import type { Session } from "./session.ts";

export { stubSession };

export class HttpError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface RouteInput {
  cookieHeader: string | null;
  host: string | null;
}

export interface MasterContext {
  userId: UserId;
  platformRoles: PlatformRole[];
}

export interface MembershipReader {
  getPlatformRoles(userId: string): Promise<PlatformRole[]>;
  getTenantMemberships(userId: string): Promise<MembershipRow[]>;
}

export interface TenantResolution {
  tenantId: TenantId;
  storeId: StoreId | null;
}

export interface RouteDeps {
  resolveSession: (cookieHeader: string | null) => Session | null;
  memberships: MembershipReader;
  resolveTenantForHost: (host: string) => Promise<TenantResolution | null>;
}

/** Leitor pendente: sem DB configurado retorna vazio -> fail closed. */
export const pendingMembershipReader: MembershipReader = {
  async getPlatformRoles(): Promise<PlatformRole[]> {
    await Promise.resolve();
    return [];
  },
  async getTenantMemberships(): Promise<MembershipRow[]> {
    await Promise.resolve();
    return [];
  },
};

async function unresolvedHost(): Promise<null> {
  await Promise.resolve();
  return null;
}

export const defaultDeps: RouteDeps = {
  resolveSession: getSessionFromCookieHeader,
  memberships: pendingMembershipReader,
  resolveTenantForHost: unresolvedHost,
};

function requireSession(input: RouteInput, deps: RouteDeps): Session {
  const session = deps.resolveSession(input.cookieHeader);
  if (!session) throw new HttpError(401, "Sessão necessária", "UNAUTHENTICATED");
  return session;
}

function toHttp(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof AuthorizationError || e instanceof TenantContextError) {
    throw new HttpError(403, e.message, "FORBIDDEN");
  }
  throw new HttpError(403, "Acesso negado", "FORBIDDEN");
}

/** /master: somente platform_owner/platform_admin. Sem service_role. */
export async function loadMaster(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<MasterContext> {
  try {
    const session = requireSession(input, deps);
    const roles = await deps.memberships.getPlatformRoles(session.userId);
    assertCanAccessMaster({ platformRoles: roles });
    return { userId: session.userId as UserId, platformRoles: roles };
  } catch (e) {
    return toHttp(e);
  }
}

function buildContext(
  session: Session,
  memberships: MembershipRow[],
  tenantId: TenantId,
  storeId: StoreId | undefined,
  host: string,
): TenantContext {
  return resolveTenantContext({
    userId: session.userId as UserId,
    platformRoles: [],
    memberships,
    activeTenantId: tenantId,
    activeStoreId: storeId,
    hostname: host,
    requestId: `route-${String(Date.now())}`,
  });
}

/** /control: membership válida no tenant resolvido pelo host (servidor). */
export async function loadControl(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<TenantContext> {
  try {
    const session = requireSession(input, deps);
    const host = input.host;
    if (!host) throw new HttpError(403, "Tenant não resolvido", "TENANT_UNRESOLVED");
    const resolved = await deps.resolveTenantForHost(host);
    if (!resolved) throw new HttpError(403, "Tenant não resolvido", "TENANT_UNRESOLVED");
    const memberships = await deps.memberships.getTenantMemberships(session.userId);
    const ctx = buildContext(session, memberships, resolved.tenantId, undefined, host);
    assertCanAccessTenantControl({ tenantRoles: ctx.tenantRoles });
    return ctx;
  } catch (e) {
    return toHttp(e);
  }
}

/** /admin: membership válida da store resolvida + role permitida. */
export async function loadStoreAdmin(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<TenantContext> {
  try {
    const session = requireSession(input, deps);
    const host = input.host;
    if (!host) throw new HttpError(403, "Store não resolvida", "STORE_UNRESOLVED");
    const resolved = await deps.resolveTenantForHost(host);
    if (!resolved || !resolved.storeId) {
      throw new HttpError(403, "Store não resolvida", "STORE_UNRESOLVED");
    }
    const memberships = await deps.memberships.getTenantMemberships(session.userId);
    const ctx = buildContext(session, memberships, resolved.tenantId, resolved.storeId, host);
    assertCanAccessStoreAdmin({ storeRoles: ctx.storeRoles });
    return ctx;
  } catch (e) {
    return toHttp(e);
  }
}
