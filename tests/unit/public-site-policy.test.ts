import { describe, expect, test } from "bun:test";
import {
  isKataluuPublicHost,
  publicCanonicalUrl,
  tenantCanRenderPublicSite,
  tenantPanelLoginUrl,
  unresolvedDomainState,
} from "../../apps/web/src/lib/public-site.policy.ts";

describe("public site policy", () => {
  test("recognizes Kataluu public and local development hosts", () => {
    expect(isKataluuPublicHost("kataluu.com.br")).toBe(true);
    expect(isKataluuPublicHost("www.kataluu.com.br")).toBe(true);
    expect(isKataluuPublicHost("localhost")).toBe(true);
    expect(isKataluuPublicHost("cliente.example.com")).toBe(false);
  });

  test("publishes only operational tenant statuses", () => {
    expect(tenantCanRenderPublicSite("active")).toBe(true);
    expect(tenantCanRenderPublicSite("trial")).toBe(true);
    expect(tenantCanRenderPublicSite("suspended")).toBe(false);
    expect(tenantCanRenderPublicSite("terminated")).toBe(false);
  });

  test("maps unresolved domains without exposing internal context", () => {
    expect(unresolvedDomainState(null, null)).toBe("unknown");
    expect(unresolvedDomainState("pending", null)).toBe("configuring");
    expect(unresolvedDomainState("active", null)).toBe("configuring");
    expect(unresolvedDomainState("suspended", "2026-09-01T00:00:00Z")).toBe("unavailable");
  });

  test("builds canonical and tenant panel URLs only from hostnames", () => {
    expect(publicCanonicalUrl("tenant.example.com")).toBe("https://tenant.example.com/");
    expect(publicCanonicalUrl("www.kataluu.com.br")).toBe("https://kataluu.com.br/");
    expect(publicCanonicalUrl("localhost")).toBeNull();
    expect(tenantPanelLoginUrl("app.tenant.example.com")).toBe("https://app.tenant.example.com/login");
    expect(tenantPanelLoginUrl(null)).toBeNull();
  });
});
