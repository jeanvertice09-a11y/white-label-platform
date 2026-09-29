import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("master audit server-side filtering", () => {
  test("todos os filtros operacionais são aplicados no SQL antes de limit/offset", () => {
    const raw = source("apps/web/src/lib/server/master-audit.read.server.ts");
    expect(raw).toContain("a.action ilike");
    expect(raw).toContain("a.actor_user_id::text");
    expect(raw).toContain("a.tenant_id::text");
    expect(raw).toContain("a.store_id::text");
    expect(raw).toContain("a.resource_type ilike");
    expect(raw).toContain("a.created_at >=");
    expect(raw).toContain("a.created_at <");
    expect(raw).toContain("limit $8 offset $9");
  });

  test("rota usa a server function paginada em vez do snapshot inteiro do console", () => {
    const route = source("apps/web/src/routes/master.audit.tsx");
    expect(route).toContain("listMasterAuditAction");
    expect(route).not.toContain("getMasterConsoleData");
  });
});
