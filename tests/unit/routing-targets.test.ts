import { describe, expect, test } from "bun:test";
import {
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

  test("tenant_site não é catálogo", () => {
    expect(rootTargetForDomainType("tenant_site")).toBeNull();
  });

  test("tipos dinâmicos resolvem somente o painel correto", () => {
    expect(rootTargetForDomainType("tenant_panel")).toBe("/control");
    expect(rootTargetForDomainType("store_admin")).toBe("/admin");
    expect(rootTargetForDomainType("store_catalog")).toBe("/catalog");
  });

  test("host público/desconhecido não ganha painel após login", () => {
    expect(loginTargetForRoot(null)).toBe("/");
  });
});
