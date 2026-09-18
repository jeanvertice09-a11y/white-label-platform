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
import { asTenantId, asStoreId } from "@white-label/tenant";
import { resolveSessionFromRequest, stubSession } from "./session.server.ts";
import type { Session } from "./session.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { DomainResolver, PostgresDomainStore } from "@white-label/domains";

export { stubSession };

export class HttpError extends Error {
  constructor(
    readonly status: 401 | 403 | 500,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface RouteInput {
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
  resolveSession: () => Promise<Session | null>;
  memberships: MembershipReader;
  resolveTenantForHost: (host: string) => Promise<TenantResolution | null>;
}

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
  resolveSession: resolveSessionFromRequest,
  memberships: pendingMembershipReader,
  resolveTenantForHost: unresolvedHost,
};

/** Sessão e memberships usam o mesmo Supabase SSR do request. */
export async function createRealDeps(): Promise<RouteDeps> {
  const sqlExecutor = createAdminSqlExecutor();
  const domainResolver = new DomainResolver(new PostgresDomainStore(sqlExecutor));
  const { createRequestMembershipReader } = await import("./request-memberships.server.ts");
  const memberships = createRequestMembershipReader();

  return {
    resolveSession: resolveSessionFromRequest,
    memberships,
    resolveTenantForHost: async (host: string) => {
      const normalized = host.toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? "";
      const resolved = await domainResolver.resolve(normalized);
      if (!resolved) return null;
      return {
        tenantId: asTenantId(resolved.tenantId),
        storeId: resolved.storeId ? asStoreId(resolved.storeId) : null,
      };
    },
  };
}

async function requireSession(_input: RouteInput, deps: RouteDeps): Promise<Session> {
  const session = await deps.resolveSession();
  if (!session) throw new HttpError(401, "Sessão necessária", "UNAUTHENTICATED");
  return session;
}

function toHttp(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof AuthorizationError || error instanceof TenantContextError) {
    throw new HttpError(403, error.message, "FORBIDDEN");
  }
  throw new HttpError(500, "Falha interna ao validar acesso", "AUTH_INTERNAL_ERROR");
}

/** /master: somente platform_owner/platform_admin. */
export async function loadMaster(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<MasterContext> {
  try {
    const session = await requireSession(input, deps);
    const roles = await deps.memberships.getPlatformRoles(session.userId);
    assertCanAccessMaster({ platformRoles: roles });
    return { userId: session.userId as UserId, platformRoles: roles };
  } catch (error) {
    return toHttp(error);
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

function normalizeRouteHost(host: string): string {
  return host.toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? "";
}

function uniqueTenantIdForSystemApp(memberships: MembershipRow[]): TenantId {
  const tenantIds = [...new Set(
    memberships
      .filter((membership) => membership.tenantRoles.length > 0)
      .map((membership) => membership.tenantId),
  )];

  if (tenantIds.length === 0) {
    throw new HttpError(403, "Usuário sem White Label vinculada", "TENANT_UNRESOLVED");
  }
  if (tenantIds.length > 1) {
    throw new HttpError(403, "Seleção de White Label necessária", "TENANT_SELECTION_REQUIRED");
  }
  const tenantId = tenantIds[0];
  if (!tenantId) {
    throw new HttpError(403, "Tenant não resolvido", "TENANT_UNRESOLVED");
  }
  return tenantId;
}

/** /control: membership válida no tenant resolvido pelo host. */
export async function loadControl(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<TenantContext> {
  try {
    const session = await requireSession(input, deps);
    const host = input.host;
    if (!host) throw new HttpError(403, "Tenant não resolvido", "TENANT_UNRESOLVED");

    const memberships = await deps.memberships.getTenantMemberships(session.userId);
    const normalizedHost = normalizeRouteHost(host);
    const tenantId = normalizedHost === "app.kataluu.com.br"
      ? uniqueTenantIdForSystemApp(memberships)
      : (await deps.resolveTenantForHost(host))?.tenantId;

    if (!tenantId) throw new HttpError(403, "Tenant não resolvido", "TENANT_UNRESOLVED");

    const ctx = buildContext(session, memberships, tenantId, undefined, host);
    assertCanAccessTenantControl({ tenantRoles: ctx.tenantRoles });
    return ctx;
  } catch (error) {
    return toHttp(error);
  }
}

/** /admin: membership válida da store resolvida + role permitida. */
export async function loadStoreAdmin(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<TenantContext> {
  try {
    const session = await requireSession(input, deps);
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
  } catch (error) {
    return toHttp(error);
  }
}
