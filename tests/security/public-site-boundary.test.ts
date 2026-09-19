import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("public site boundary", () => {
  test("root keeps DomainResolver as the authority before rendering tenant site", () => {
    const server = source("apps/web/src/lib/server/public-site.server.ts");
    expect(server).toContain("new DomainResolver(createServiceDomainStore()).resolve(host)");
    expect(server).toContain('resolved.type !== "tenant_site"');
    expect(server).toContain("resolved.tenantId");
  });

  test("public payload query is minimal and excludes private operational data", () => {
    const server = source("apps/web/src/lib/server/public-site.server.ts");
    expect(server).toContain("t.name,t.status,b.logo_url,b.primary_color");
    expect(server).not.toContain("audit_logs");
    expect(server).not.toContain("tenant_members");
    expect(server).not.toContain("subscriptions");
    expect(server).not.toContain("payments");
    expect(server).not.toContain("gateway_account_secrets");
  });

  test("unknown and pending domains render public states instead of Kataluu tenant data", () => {
    const route = source("apps/web/src/routes/index.tsx");
    expect(route).toContain("getPublicSiteExperience");
    expect(route).toContain("PublicDomainStateView");
    expect(route).toContain('data.site.kind === "white_label"');
  });
});
