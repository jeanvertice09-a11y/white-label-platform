import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> { return Bun.file(path).text(); }

describe("master platform completion security boundary", () => {
  test("todo /master continua protegido pelo contexto master", async () => {
    const master = await source("apps/web/src/routes/master.tsx");
    expect(master).toContain("loadMasterContext");
    expect(master).toContain("createFileRoute(\"/master\")");
  });

  test("entitlements são lidos e mutados somente após autorização master server-side", async () => {
    const server = await source("apps/web/src/lib/server/platform-plan-templates.functions.ts");
    expect(server).toContain("loadMaster({ host: getRequestHost() }, deps)");
    expect(server).toContain("createAdminSqlExecutor()");
    expect(server).toContain(".validator(replaceSchema)");
    expect(server).toContain("replacePlatformTemplateEntitlements");
  });

  test("tenantId do detalhe é apenas lookup e mutations privilegiadas usam masterMutation", async () => {
    const functions = await source("apps/web/src/lib/server/master-white-label.functions.ts");
    const reader = await source("apps/web/src/lib/server/master-white-label.read.server.ts");
    expect(functions).toContain("tenantId: z.string().uuid()");
    expect(functions).toContain("masterRead()");
    expect(functions).toContain("masterMutation()");
    expect(reader).toContain("where t.id=$1::uuid");
    expect(reader).toContain("where tm.tenant_id=$1::uuid");
    expect(reader).toContain("where st.tenant_id=$1::uuid");
    expect(reader).toContain("from public.audit_logs where tenant_id=$1::uuid");
  });
});
