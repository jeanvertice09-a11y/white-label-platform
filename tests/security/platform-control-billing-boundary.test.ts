import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("platform/control billing and tenant boundary", () => {
  test("dashboard não cria uma segunda fonte de billing fora do domínio tenant_billing", () => {
    const control = source("apps/web/src/lib/server/platform-console.control.server.ts");
    expect(control).not.toContain('.from("subscriptions")');
    expect(control).not.toContain('.from("payments")');
    expect(control).toContain('.from("tenant_plans")');
    expect(control).toContain('.eq("tenant_id", tenantId)');

    const billing = source("apps/web/src/lib/server/tenant-billing.read.server.ts");
    expect(billing).toContain("p.level='tenant_billing'");
    expect(billing).toContain("p.status='captured'");
    expect(billing).toContain("revenue_captured_cents");
  });

  test("memberships e auditoria do control permanecem escopados ao tenant resolvido no servidor", () => {
    const control = source("apps/web/src/lib/server/platform-console.control.server.ts");
    expect(control).toContain('.from("tenant_members")');
    expect(control).toContain('.from("audit_logs")');
    expect(control.match(/\.eq\("tenant_id", tenantId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });

  test("master detail consulta lojas e auditoria usando tenant_id como autoridade", () => {
    const master = source("apps/web/src/lib/server/master-white-label.read.server.ts");
    expect(master).toContain("from public.stores st");
    expect(master).toContain("where st.tenant_id=$1::uuid");
    expect(master).toContain("from public.audit_logs where tenant_id=$1::uuid");
  });
});
