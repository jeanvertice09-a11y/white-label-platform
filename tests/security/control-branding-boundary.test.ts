import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("control branding boundary", () => {
  test("mutação deriva tenant do contexto e não aceita tenantId vindo do browser", () => {
    const fn = source("apps/web/src/lib/server/control-branding.functions.ts");
    expect(fn).toContain("controlMerchantMutation()");
    expect(fn).toContain("ctx.tenantId");
    expect(fn).not.toContain("tenantId: z.");
  });

  test("persistência de branding falha fechada no tenant e gera auditoria", () => {
    const write = source("apps/web/src/lib/server/control-branding.write.server.ts");
    expect(write).toContain("where id=$1::uuid");
    expect(write).toContain("public.tenant_branding");
    expect(write).toContain("public.audit_logs");
    expect(write).toContain("control.branding.updated");
  });
});
