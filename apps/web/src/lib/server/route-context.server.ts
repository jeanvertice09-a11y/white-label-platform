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
import { DomainResolver } from "@white-label/domains";
import type { DomainType } from "@white-label/domains";
import { normalizeRoutingHost } from "../routing-targets.ts";
import { resolveSessionFromRequest, stubSession } from "./session.server.ts";
import type { Session } from "./session.server.ts";
import { createServiceDomainStore } from "./supabase-domain-store.server.ts";
import { createServiceSupabaseClient } from "./supabase-service.server.ts";

export { stubSession };

export class HttpError extends Error {
  constructor(
    readonly status: 401 | 403 | 404 | 500,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface RouteInput { host: string | null; }
export interface MasterContext { userId: UserId; platformRoles: PlatformRole[]; }
export interface MembershipReader {
  getPlatformRoles(userId: string): Promise<PlatformRole[]>;
  getTenantMemberships(userId: string): Promise<MembershipRow[]>;
}
export interface TenantResolution { tenantId: TenantId; storeId: StoreId | null; type: DomainType; }
export interface RouteDeps {
  resolveSession: () => Promise<Session | null>;
  memberships: MembershipReader;
  resolveTenantForHost: (host: string) => Promise<TenantResolution | null>;
  getTenantStatus: (tenantId: string) => Promise<string | null>;
  getStoreStatus?: (tenantId: string, storeId: string) => Promise<string | null>;
}

export const pendingMembershipReader: MembershipReader = {
  async getPlatformRoles(): Promise<PlatformRole[]> { await Promise.resolve(); return []; },
  async getTenantMemberships(): Promise<MembershipRow[]> { await Promise.resolve(); return []; },
};
async function unresolvedHost(): Promise<null> { await Promise.resolve(); return null; }
async function unresolvedTenantStatus(): Promise<null> { await Promise.resolve(); return null; }

export const defaultDeps: RouteDeps = {
  resolveSession: resolveSessionFromRequest,
  memberships: pendingMembershipReader,
  resolveTenantForHost: unresolvedHost,
  getTenantStatus: unresolvedTenantStatus,
};

/** Sessão/memberships usam Supabase SSR; domínios e status usam fonte autoritativa server-side. */
export async function createRealDeps(): Promise<RouteDeps> {
  const domainResolver = new DomainResolver(createServiceDomainStore());
  const serviceClient = createServiceSupabaseClient();
  const { createRequestMembershipReader } = await import("./request-memberships.server.ts");
  const memberships = createRequestMembershipReader();
  return {
    resolveSession: resolveSessionFromRequest,
    memberships,
    resolveTenantForHost: async (host: string) => {
      const resolved = await domainResolver.resolve(normalizeRoutingHost(host));
      if (!resolved) return null;
      return {
        tenantId: asTenantId(resolved.tenantId),
        storeId: resolved.storeId ? asStoreId(resolved.storeId) : null,
        type: resolved.type,
      };
    },
    getTenantStatus: async (tenantId: string) => {
      const { data, error } = await serviceClient.from("tenants").select("status").eq("id", tenantId).maybeSingle();
      if (error) throw new Error(`Falha ao consultar status da White Label: ${error.message}`);
      return typeof data?.status === "string" ? data.status : null;
    },
    getStoreStatus: async (tenantId: string, storeId: string) => {
      const { data, error } = await serviceClient
        .from("stores")
        .select("status")
        .eq("tenant_id", tenantId)
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw new Error(`Falha ao consultar status da loja: ${error.message}`);
      return typeof data?.status === "string" ? data.status : null;
    },
  };
}

async function requireSession(_input: RouteInput, deps: RouteDeps): Promise<Session> {
  const session = await deps.resolveSession();
  if (!session) throw new HttpError(401, "Sessão necessária", "UNAUTHENTICATED");
  return session;
}

/** Painéis privilegiados e suas server functions exigem sessão Supabase em AAL2. */
export function requireMfaAssurance(session: Session): void {
  if (session.assuranceLevel !== "aal2") {
    throw new HttpError(403, "Confirme o segundo fator para continuar", "MFA_REQUIRED");
  }
}

const FORBIDDEN_TENANT_CONTEXT_CODES = new Set(["TENANT_FORBIDDEN", "STORE_FORBIDDEN", "CROSS_TENANT_DENIED", "CROSS_STORE_DENIED"]);
function toHttp(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof AuthorizationError) throw new HttpError(403, error.message, "FORBIDDEN");
  if (error instanceof TenantContextError) {
    const status = FORBIDDEN_TENANT_CONTEXT_CODES.has(error.code) ? 403 : 500;
    throw new HttpError(status, error.message, error.code);
  }
  throw new HttpError(500, "Falha interna ao validar acesso", "AUTH_INTERNAL_ERROR");
}
function requireHost(input: RouteInput): string {
  const host = normalizeRoutingHost(input.host);
  if (!host) throw new HttpError(404, "Host não encontrado", "HOST_NOT_FOUND");
  return host;
}
async function assertTenantOperational(deps: RouteDeps, tenantId: TenantId): Promise<void> {
  const status = await deps.getTenantStatus(String(tenantId));
  if (status === null) throw new HttpError(404, "White Label não encontrada", "TENANT_NOT_FOUND");
  if (status !== "active" && status !== "trial") throw new HttpError(403, "White Label indisponível", "TENANT_SUSPENDED");
}
async function assertStoreOperational(
  deps: RouteDeps,
  tenantId: TenantId,
  storeId: StoreId,
): Promise<void> {
  if (!deps.getStoreStatus) return;
  const status = await deps.getStoreStatus(String(tenantId), String(storeId));
  if (status === null) throw new HttpError(404, "Loja não encontrada", "STORE_NOT_FOUND");
  if (status !== "active") throw new HttpError(403, "Loja indisponível", "STORE_SUSPENDED");
}

/** /master: somente host de sistema + platform_owner/platform_admin + MFA AAL2. */
export async function loadMaster(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<MasterContext> {
  try {
    const session = await requireSession(input, deps);
    requireMfaAssurance(session);
    const host = requireHost(input);
    if (host !== "control.geral.kataluu.com.br") throw new HttpError(404, "Painel Master não existe neste host", "HOST_ROUTE_MISMATCH");
    const roles = await deps.memberships.getPlatformRoles(session.userId);
    assertCanAccessMaster({ platformRoles: roles });
    return { userId: session.userId as UserId, platformRoles: roles };
  } catch (error) { return toHttp(error); }
}

function buildContext(session: Session, memberships: MembershipRow[], tenantId: TenantId, storeId: StoreId | undefined, host: string): TenantContext {
  return resolveTenantContext({ userId: session.userId as UserId, platformRoles: [], memberships, activeTenantId: tenantId, activeStoreId: storeId, hostname: host, requestId: `route-${String(Date.now())}` });
}
function uniqueTenantIdForSystemApp(memberships: MembershipRow[]): TenantId {
  const tenantIds = [...new Set(memberships.filter((membership) => membership.tenantRoles.length > 0).map((membership) => membership.tenantId))];
  if (tenantIds.length === 0) throw new HttpError(403, "Usuário sem White Label vinculada", "TENANT_UNRESOLVED");
  if (tenantIds.length > 1) throw new HttpError(403, "Seleção de White Label necessária", "TENANT_SELECTION_REQUIRED");
  const tenantId = tenantIds[0];
  if (!tenantId) throw new HttpError(500, "Tenant não resolvido", "TENANT_CONTEXT_INVALID");
  return tenantId;
}
function requireDomain(resolved: TenantResolution | null, expected: DomainType): TenantResolution {
  if (!resolved) throw new HttpError(404, "Host não encontrado", "HOST_NOT_FOUND");
  if (resolved.type !== expected) throw new HttpError(404, "Painel não existe neste tipo de domínio", "HOST_ROUTE_MISMATCH");
  return resolved;
}

/** /control: tenant_panel dinâmico ou app.kataluu.com.br com tenant não ambíguo + MFA AAL2. */
export async function loadControl(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<TenantContext> {
  try {
    const session = await requireSession(input, deps);
    requireMfaAssurance(session);
    const host = requireHost(input);
    const memberships = await deps.memberships.getTenantMemberships(session.userId); let tenantId: TenantId;
    if (host === "app.kataluu.com.br") tenantId = uniqueTenantIdForSystemApp(memberships);
    else {
      const resolved = requireDomain(await deps.resolveTenantForHost(host), "tenant_panel");
      if (resolved.storeId !== null) throw new HttpError(500, "tenant_panel com store inválida", "DOMAIN_SCOPE_INVALID");
      tenantId = resolved.tenantId;
    }
    await assertTenantOperational(deps, tenantId);
    const ctx = buildContext(session, memberships, tenantId, undefined, host);
    assertCanAccessTenantControl({ tenantRoles: ctx.tenantRoles });
    return ctx;
  } catch (error) { return toHttp(error); }
}

/** /admin: somente domínio store_admin + membership explícita da store + MFA AAL2. */
export async function loadStoreAdmin(input: RouteInput, deps: RouteDeps = defaultDeps): Promise<TenantContext> {
  try {
    const session = await requireSession(input, deps);
    requireMfaAssurance(session);
    const host = requireHost(input);
    const resolved = requireDomain(await deps.resolveTenantForHost(host), "store_admin");
    if (!resolved.storeId) throw new HttpError(500, "store_admin sem store", "DOMAIN_SCOPE_INVALID");
    await assertTenantOperational(deps, resolved.tenantId);
    await assertStoreOperational(deps, resolved.tenantId, resolved.storeId);
    const memberships = await deps.memberships.getTenantMemberships(session.userId);
    const ctx = buildContext(session, memberships, resolved.tenantId, resolved.storeId, host);
    assertCanAccessStoreAdmin({ storeRoles: ctx.storeRoles });
    return ctx;
  } catch (error) { return toHttp(error); }
}
