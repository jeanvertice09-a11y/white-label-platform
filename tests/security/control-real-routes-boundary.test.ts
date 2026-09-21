import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("control real routes security boundary", () => {
  test("rotas não aceitam tenantId do browser como autoridade", () => {
    const routeFiles = [
      "control.tsx",
      "control.index.tsx",
      "control.stores.tsx",
      "control.stores_.$storeId.tsx",
      "control.billing.tsx",
      "control.plans.tsx",
      "control.branding.tsx",
      "control.domains.tsx",
      "control.payments.tsx",
      "control.team.tsx",
      "control.audit.tsx",
    ];
    for (const name of routeFiles) {
      const file = source(`apps/web/src/routes/${name}`);
      expect(file).not.toContain("tenantId:");
      expect(file).not.toContain("tenantId =");
    }
  });

  test("storeId da URL é apenas lookup e a consulta continua limitada ao tenant atual", () => {
    const route = source("apps/web/src/routes/control.stores_.$storeId.tsx");
    const functions = source("apps/web/src/lib/server/control-merchants.functions.ts");
    const read = source("apps/web/src/lib/server/control-merchants.read.server.ts");
    expect(route).toContain("loader: async ({ params: { storeId } })");
    expect(route).toContain("getControlMerchant({ data: { storeId } })");
    expect(functions).toContain("ctx.tenantId");
    expect(read).toContain("s.tenant_id=$1::uuid and s.id=$2::uuid");
  });

  test("separação de rotas não replica nem relaxa guards de mutação", () => {
    const routes = source("apps/web/src/routes/control.stores.tsx") + source("apps/web/src/routes/control.stores_.$storeId.tsx");
    expect(routes).not.toContain("assertCanManageTenantStores");
    expect(routes).not.toContain("tenant_owner");
    expect(routes).not.toContain("tenant_admin");

    const functions = source("apps/web/src/lib/server/control-merchants.functions.ts");
    const shared = source("apps/web/src/lib/server/control-merchants.shared.server.ts");
    expect(functions).toContain("controlMerchantMutation()");
    expect(shared).toContain("assertCanManageTenantStores");
    expect(shared).toContain("if (requireAdmin) assertCanManageTenantStores({ tenantRoles: ctx.tenantRoles });");
    expect(shared).toContain("export async function controlMerchantMutation()");
    expect(shared).toContain("return context(true);");
  });
});
