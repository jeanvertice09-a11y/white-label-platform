import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("control onboarding boundary", () => {
  test("tenant id comes from authenticated control context, never browser input", () => {
    const fn = source("apps/web/src/lib/server/control-onboarding.functions.ts");
    expect(fn).toContain("loadControl({ host: getRequestHost() }");
    expect(fn).toContain("String(ctx.tenantId)");
    expect(fn).not.toContain("validator(");
  });

  test("checklist is derived from persisted state and does not store fake completion", () => {
    const read = source("apps/web/src/lib/server/control-onboarding.server.ts");
    expect(read).toContain("public.tenant_branding");
    expect(read).toContain("public.domains");
    expect(read).toContain("public.tenant_plans");
    expect(read).toContain("public.stores");
    expect(read).toContain("public.gateway_accounts");
    expect(read).toContain("g.level='tenant_billing'");
    expect(read).not.toContain("setup_completed");
  });

  test("login fetches onboarding only after authenticated control flow", () => {
    const route = source("apps/web/src/routes/login.tsx");
    expect(route).toContain('data.destination === "/control"');
    expect(route).toContain("/login?onboarding=1");
    expect(route).toContain("getControlOnboarding");
  });
});
