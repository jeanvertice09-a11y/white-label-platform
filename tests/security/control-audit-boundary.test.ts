import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("control audit tenant isolation", () => {
  test("tenantId vem do TenantContext e nunca dos filtros do browser", () => {
    const fn = source("apps/web/src/lib/server/control-audit.functions.ts");
    expect(fn).toContain("controlMerchantRead()");
    expect(fn).toContain("ctx.tenantId");
    expect(fn).not.toContain("tenantId: z.");
  });

  test("query falha fechada pelo tenant antes dos filtros e paginação", () => {
    const read = source("apps/web/src/lib/server/control-audit.read.server.ts");
    expect(read).toContain("where a.tenant_id=$1::uuid");
    expect(read).toContain("a.store_id::text");
    expect(read).toContain("a.resource_type ilike");
    expect(read).toContain("limit $8 offset $9");
  });
});
