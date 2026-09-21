import { describe, expect, test } from "bun:test";
import {
  billingLevelLabel,
  domainTypeLabel,
  layoutLabel,
  roleLabel,
  statusLabel,
} from "../../apps/web/src/lib/ui-labels.ts";

describe("panel UI labels", () => {
  test("traduz status sem alterar o valor interno", () => {
    expect(statusLabel("active")).toBe("Ativo");
    expect(statusLabel("trialing")).toBe("Em período de teste");
    expect(statusLabel("past_due")).toBe("Pagamento atrasado");
    expect(statusLabel("suspended")).toBe("Suspenso");
    expect(statusLabel("canceled")).toBe("Cancelado");
    expect(statusLabel("failed")).toBe("Falhou");
  });

  test("traduz tipos de domínio", () => {
    expect(domainTypeLabel("tenant_panel")).toBe("Painel da White Label");
    expect(domainTypeLabel("store_catalog")).toBe("Loja pública");
  });

  test("traduz níveis de cobrança e perfis", () => {
    expect(billingLevelLabel("platform_billing")).toBe("Assinatura Kataluu");
    expect(billingLevelLabel("tenant_billing")).toBe("Cobrança dos lojistas");
    expect(roleLabel("tenant_owner")).toBe("Responsável principal");
  });

  test("traduz nomes de layout", () => {
    expect(layoutLabel("classic")).toBe("Clássico");
    expect(layoutLabel("modern")).toBe("Moderno");
  });

  test("preserva valores desconhecidos para evitar mascarar estados novos", () => {
    expect(statusLabel("future_status")).toBe("future_status");
  });
});
