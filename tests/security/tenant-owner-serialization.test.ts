import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/0029_tenant_owner_serialization.sql", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../../apps/web/src/lib/server/control-team.functions.ts", import.meta.url),
  "utf8",
);
const guard = readFileSync(
  new URL("../../apps/web/src/lib/server/control-team-tenant-guard.server.ts", import.meta.url),
  "utf8",
);

describe("tenant owner serialization boundary", () => {
  test("mutações de owner são serializadas pelo tenant antes da contagem", () => {
    expect(migration).toContain("from public.tenants where id=p_tenant_id for update");
    expect(migration).toContain("where tenant_id=p_tenant_id and role='tenant_owner'");
    expect(migration).toContain("if v_owner_count <= 1 then");
    expect(migration).toContain("A White Label precisa manter pelo menos um tenant_owner.");
  });

  test("funções SQL revalidam o papel atual do ator e não confiam só na sessão", () => {
    expect(migration).toContain("where tm.tenant_id=p_tenant_id and tm.user_id=p_actor_user_id");
    expect(migration).toContain("v_actor_role not in ('tenant_owner','tenant_admin')");
    expect(migration).toContain("p_actor_is_owner is distinct from (v_actor_role='tenant_owner')");
  });

  test("RPCs de mutação não ficam expostas a anon/authenticated", () => {
    expect(migration).toContain("control_upsert_tenant_member_guarded(uuid,uuid,text,uuid,boolean) from anon");
    expect(migration).toContain("control_upsert_tenant_member_guarded(uuid,uuid,text,uuid,boolean) from authenticated");
    expect(migration).toContain("control_remove_tenant_member_guarded(uuid,uuid,uuid,boolean) from anon");
    expect(migration).toContain("control_remove_tenant_member_guarded(uuid,uuid,uuid,boolean) from authenticated");
  });

  test("ServerFns de tenant team passam pelo boundary guardado", () => {
    expect(actions).toContain("upsertTenantMemberGuarded");
    expect(actions).toContain("removeTenantMemberGuarded");
    expect(guard).toContain("public.control_upsert_tenant_member_guarded");
    expect(guard).toContain("public.control_remove_tenant_member_guarded");
    expect(guard).not.toContain("getRequestHost");
  });
});
