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

  test("login preserva submit real, MFA e onboarding autenticado com destino canônico", () => {
    const route = source("apps/web/src/routes/login.tsx");
    const mfa = source("apps/web/src/routes/mfa.tsx");
    expect(route).toContain("validateSearch: parseLoginSearch");
    expect(route).toContain("postLoginLocation(data.destination)");
    expect(route).toContain('window.location.assign(`/mfa?next=${encodeURIComponent(next)}`)');
    expect(mfa).toContain('"/login?onboarding=true"');
    expect(route).toContain("getControlOnboarding");
    expect(route).toContain("await signInWithPassword(email, password)");
    expect(route).toContain("<form onSubmit=");
    expect(route).not.toContain("if (!data.experience.available) return;");
    expect(route).not.toContain("try { onboarding = await getControlOnboarding(); } catch");
  });
});
