import { describe, expect, test } from "bun:test";
import {
  isStorefrontDomainType,
  loginTargetForRoot,
  rootTargetForDomainType,
  systemTargetForHost,
} from "../../apps/web/src/lib/routing-targets.ts";

describe("hostname routing targets", () => {
  test("hosts internos Kataluu mantêm destinos explícitos", () => {
    expect(systemTargetForHost("control.geral.kataluu.com.br")).toBe("/master");
    expect(systemTargetForHost("app.kataluu.com.br")).toBe("/control");
    expect(systemTargetForHost("kataluu.com.br")).toBeNull();
    expect(systemTargetForHost("host-desconhecido.example")).toBeUndefined();
  });

  test("tenant_site não é storefront", () => {
    expect(rootTargetForDomainType("tenant_site")).toBeNull();
    expect(isStorefrontDomainType("tenant_site")).toBe(false);
  });

  test("tipos dinâmicos resolvem somente o destino correto", () => {
    expect(rootTargetForDomainType("tenant_panel")).toBe("/control");
    expect(rootTargetForDomainType("store_admin")).toBe("/admin");
    expect(rootTargetForDomainType("store_catalog")).toBeNull();
    expect(isStorefrontDomainType("store_catalog")).toBe(true);
  });

  test("host público/desconhecido não ganha painel após login", () => {
    expect(loginTargetForRoot(null)).toBe("/");
  });
});
