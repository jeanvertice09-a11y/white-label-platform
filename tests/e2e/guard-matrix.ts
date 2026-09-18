// Matriz executável dos loaders reais /master, /control e /admin.
import { loadControl, loadMaster, loadStoreAdmin } from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps, TenantResolution } from "../../apps/web/src/lib/server/route-context.server.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.server.ts";
import type { PlatformRole } from "../../packages/auth/src/roles.ts";
import type { MembershipRow } from "../../packages/tenant/src/context.ts";
import type { StoreId, TenantId } from "../../packages/tenant/src/branded.ts";

const TA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId; const TB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as TenantId; const SA = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa" as StoreId; const SB = "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb" as StoreId; const U = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
interface Case { name: string; run: () => Promise<unknown>; expect: "allow" | "deny"; }
function deps(over: Partial<RouteDeps>): RouteDeps { return { resolveSession: () => Promise.resolve(null), memberships: { getPlatformRoles: () => Promise.resolve([]), getTenantMemberships: () => Promise.resolve([]) }, resolveTenantForHost: () => Promise.resolve(null), getTenantStatus: () => Promise.resolve("active"), ...over }; }
function userDeps(userId: string, platform: PlatformRole[], tenants: MembershipRow[], hostMap: Record<string, TenantResolution>, status: string | null = "active"): RouteDeps { return deps({ resolveSession: () => Promise.resolve(stubSession(userId)), memberships: { getPlatformRoles: () => Promise.resolve(platform), getTenantMemberships: () => Promise.resolve(tenants) }, resolveTenantForHost: (host) => Promise.resolve(hostMap[host] ?? null), getTenantStatus: () => Promise.resolve(status) }); }
const tenantA: MembershipRow[] = [{ tenantId: TA, tenantRoles: ["tenant_admin"], storeRoles: [] }]; const storeAAdmin: MembershipRow[] = [{ tenantId: TA, storeId: SA, tenantRoles: ["tenant_admin"], storeRoles: ["store_admin"] }]; const storeAStaff: MembershipRow[] = [{ tenantId: TA, storeId: SA, tenantRoles: [], storeRoles: ["store_staff"] }];
const cases: Case[] = [
  { name: "visitante não autenticado não acessa /master", run: () => loadMaster({ host: "control.geral.kataluu.com.br" }, deps({})), expect: "deny" },
  { name: "visitante não autenticado não acessa /control", run: () => loadControl({ host: "a.example.com" }, deps({})), expect: "deny" },
  { name: "visitante não autenticado não acessa /admin", run: () => loadStoreAdmin({ host: "s.example.com" }, deps({})), expect: "deny" },
  { name: "tenant comum não acessa /master", run: () => loadMaster({ host: "control.geral.kataluu.com.br" }, userDeps(U, [], tenantA, {})), expect: "deny" },
  { name: "platform_support não acessa /master", run: () => loadMaster({ host: "control.geral.kataluu.com.br" }, userDeps(U, ["platform_support"], [], {})), expect: "deny" },
  { name: "platform_finance não acessa /master", run: () => loadMaster({ host: "control.geral.kataluu.com.br" }, userDeps(U, ["platform_finance"], [], {})), expect: "deny" },
  { name: "platform_owner acessa /master", run: () => loadMaster({ host: "control.geral.kataluu.com.br" }, userDeps(U, ["platform_owner"], [], {})), expect: "allow" },
  { name: "platform_admin acessa /master", run: () => loadMaster({ host: "control.geral.kataluu.com.br" }, userDeps(U, ["platform_admin"], [], {})), expect: "allow" },
  { name: "master não existe em host arbitrário", run: () => loadMaster({ host: "x.example.com" }, userDeps(U, ["platform_owner"], [], {})), expect: "deny" },
  { name: "Tenant A não acessa /control do Tenant B", run: () => loadControl({ host: "b.example.com" }, userDeps(U, [], tenantA, { "b.example.com": { tenantId: TB, storeId: null, type: "tenant_panel" } })), expect: "deny" },
  { name: "Tenant A acessa tenant_panel próprio", run: () => loadControl({ host: "a.example.com" }, userDeps(U, [], tenantA, { "a.example.com": { tenantId: TA, storeId: null, type: "tenant_panel" } })), expect: "allow" },
  { name: "suspensa bloqueia /control por domínio", run: () => loadControl({ host: "a.example.com" }, userDeps(U, [], tenantA, { "a.example.com": { tenantId: TA, storeId: null, type: "tenant_panel" } }, "suspended")), expect: "deny" },
  { name: "suspensa bloqueia /control no app.kataluu.com.br", run: () => loadControl({ host: "app.kataluu.com.br" }, userDeps(U, [], tenantA, {}, "suspended")), expect: "deny" },
  { name: "tenant_site não vira /control", run: () => loadControl({ host: "site.example.com" }, userDeps(U, [], tenantA, { "site.example.com": { tenantId: TA, storeId: null, type: "tenant_site" } })), expect: "deny" },
  { name: "Store A não acessa /admin da Store B", run: () => loadStoreAdmin({ host: "sb.example.com" }, userDeps(U, [], storeAAdmin, { "sb.example.com": { tenantId: TA, storeId: SB, type: "store_admin" } })), expect: "deny" },
  { name: "store_catalog não vira /admin", run: () => loadStoreAdmin({ host: "catalog.example.com" }, userDeps(U, [], storeAAdmin, { "catalog.example.com": { tenantId: TA, storeId: SA, type: "store_catalog" } })), expect: "deny" },
  { name: "store_staff não acessa /admin", run: () => loadStoreAdmin({ host: "sa.example.com" }, userDeps(U, [], storeAStaff, { "sa.example.com": { tenantId: TA, storeId: SA, type: "store_admin" } })), expect: "deny" },
  { name: "store_admin acessa /admin própria", run: () => loadStoreAdmin({ host: "sa.example.com" }, userDeps(U, [], storeAAdmin, { "sa.example.com": { tenantId: TA, storeId: SA, type: "store_admin" } })), expect: "allow" },
  { name: "suspensa bloqueia /admin", run: () => loadStoreAdmin({ host: "sa.example.com" }, userDeps(U, [], storeAAdmin, { "sa.example.com": { tenantId: TA, storeId: SA, type: "store_admin" } }, "suspended")), expect: "deny" },
];
export interface MatrixResult { passed: number; failed: number; failures: string[]; }
export async function runGuardMatrix(): Promise<MatrixResult> { const failures: string[] = []; for (const c of cases) { let allowed = true; try { await c.run(); } catch { allowed = false; } const ok = c.expect === "allow" ? allowed : !allowed; if (!ok) failures.push(`${c.name} (esperado ${c.expect})`); } return { passed: cases.length - failures.length, failed: failures.length, failures }; }
