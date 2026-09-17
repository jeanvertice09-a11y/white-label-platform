// Matriz de autorização EXECUTÁVEL: exercita os loaders server-side reais
// (loadMaster/loadControl/loadStoreAdmin) usados pelas rotas /master,
// /control e /admin. Falha fechada: qualquer contexto inválido nega.
// Usada por tests/security/route-guards.test.ts e tests/e2e/smoke.ts.
import { loadControl, loadMaster, loadStoreAdmin } from "../../apps/web/src/lib/server/route-context.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.ts";
import type { PlatformRole } from "../../packages/auth/src/roles.ts";
import type { MembershipRow } from "../../packages/tenant/src/context.ts";
import type { StoreId, TenantId } from "../../packages/tenant/src/branded.ts";

const TA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId;
const TB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as TenantId;
const SA = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa" as StoreId;
const SB = "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb" as StoreId;

interface Case {
  name: string;
  run: () => Promise<unknown>;
  expect: "allow" | "deny";
}

function deps(over: Partial<RouteDeps>): RouteDeps {
  return {
    resolveSession: () => null,
    memberships: {
      async getPlatformRoles() {
        await Promise.resolve();
        return [];
      },
      async getTenantMemberships() {
        await Promise.resolve();
        return [];
      },
    },
    resolveTenantForHost: async () => {
      await Promise.resolve();
      return null;
    },
    ...over,
  };
}

function userDeps(userId: string, platform: PlatformRole[], tenants: MembershipRow[], hostMap: Record<string, { tenantId: TenantId; storeId: StoreId | null }>): RouteDeps {
  return deps({
    resolveSession: () => stubSession(userId),
    memberships: {
      async getPlatformRoles() {
        await Promise.resolve();
        return platform;
      },
      async getTenantMemberships() {
        await Promise.resolve();
        return tenants;
      },
    },
    resolveTenantForHost: async (host) => {
      await Promise.resolve();
      return hostMap[host] ?? null;
    },
  });
}

const U = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tenantA: MembershipRow[] = [{ tenantId: TA, tenantRoles: ["tenant_admin"], storeRoles: [] }];
const storeAAdmin: MembershipRow[] = [
  { tenantId: TA, storeId: SA, tenantRoles: ["tenant_admin"], storeRoles: ["store_admin"] },
];
const storeAStaff: MembershipRow[] = [
  { tenantId: TA, storeId: SA, tenantRoles: [], storeRoles: ["store_staff"] },
];

const cases: Case[] = [
  {
    name: "visitante nao autenticado NAO acessa /master (401)",
    run: () => loadMaster({ cookieHeader: null, host: "x.example.com" }, deps({})),
    expect: "deny",
  },
  {
    name: "visitante nao autenticado NAO acessa /control (401)",
    run: () => loadControl({ cookieHeader: null, host: "a.example.com" }, deps({})),
    expect: "deny",
  },
  {
    name: "visitante nao autenticado NAO acessa /admin (401)",
    run: () => loadStoreAdmin({ cookieHeader: null, host: "s.example.com" }, deps({})),
    expect: "deny",
  },
  {
    name: "tenant comum NAO acessa /master (403)",
    run: () => loadMaster({ cookieHeader: "s", host: null }, userDeps(U, [], tenantA, {})),
    expect: "deny",
  },
  {
    name: "platform_support NAO acessa /master (403)",
    run: () =>
      loadMaster(
        { cookieHeader: "s", host: null },
        userDeps(U, ["platform_support"], [], {}),
      ),
    expect: "deny",
  },
  {
    name: "platform_owner acessa /master",
    run: () =>
      loadMaster({ cookieHeader: "s", host: null }, userDeps(U, ["platform_owner"], [], {})),
    expect: "allow",
  },
  {
    name: "platform_admin acessa /master",
    run: () =>
      loadMaster({ cookieHeader: "s", host: null }, userDeps(U, ["platform_admin"], [], {})),
    expect: "allow",
  },
  {
    name: "usuario do Tenant A nao acessa /control do Tenant B",
    run: () =>
      loadControl({ cookieHeader: "s", host: "b.example.com" }, userDeps(U, [], tenantA, {
        "b.example.com": { tenantId: TB, storeId: null },
      })),
    expect: "deny",
  },
  {
    name: "usuario do Tenant A acessa /control do Tenant A",
    run: () =>
      loadControl({ cookieHeader: "s", host: "a.example.com" }, userDeps(U, [], tenantA, {
        "a.example.com": { tenantId: TA, storeId: null },
      })),
    expect: "allow",
  },
  {
    name: "usuario da Store A nao acessa /admin da Store B",
    run: () =>
      loadStoreAdmin({ cookieHeader: "s", host: "sb.example.com" }, userDeps(U, [], storeAAdmin, {
        "sb.example.com": { tenantId: TA, storeId: SB },
      })),
    expect: "deny",
  },
  {
    name: "store_staff nao acessa /admin (role insuficiente)",
    run: () =>
      loadStoreAdmin({ cookieHeader: "s", host: "sa.example.com" }, userDeps(U, [], storeAStaff, {
        "sa.example.com": { tenantId: TA, storeId: SA },
      })),
    expect: "deny",
  },
  {
    name: "store_admin acessa /admin da propria store",
    run: () =>
      loadStoreAdmin({ cookieHeader: "s", host: "sa.example.com" }, userDeps(U, [], storeAAdmin, {
        "sa.example.com": { tenantId: TA, storeId: SA },
      })),
    expect: "allow",
  },
];

export interface MatrixResult {
  passed: number;
  failed: number;
  failures: string[];
}

export async function runGuardMatrix(): Promise<MatrixResult> {
  const failures: string[] = [];
  for (const c of cases) {
    let allowed = true;
    try {
      await c.run();
    } catch {
      allowed = false;
    }
    const ok = c.expect === "allow" ? allowed : !allowed;
    if (!ok) failures.push(`${c.name} (esperado ${c.expect})`);
  }
  return { passed: cases.length - failures.length, failed: failures.length, failures };
}
