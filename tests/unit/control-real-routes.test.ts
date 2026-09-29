import { describe, expect, test } from "bun:test";
import { controlNavigation, isControlNavigationItemActive } from "../../apps/web/src/features/control/control-navigation.ts";

const expectedRoutes = [
  "/control",
  "/control/stores",
  "/control/billing",
  "/control/plans",
  "/control/plans",
  "/control/branding",
  "/control/domains",
  "/control/payments",
  "/control/team",
  "/control/audit",
];

describe("control real routes", () => {
  test("menu usa somente rotas reais e não mantém âncoras do lote 1", () => {
    const items = controlNavigation.flatMap((group) => group.items);
    expect(items.map((item) => item.to)).toEqual(expectedRoutes);
    expect(items.some((item) => item.to.startsWith("#"))).toBe(false);
  });

  test("detalhe de loja mantém Lojas como item ativo", () => {
    const stores = controlNavigation.flatMap((group) => group.items).find((item) => item.to === "/control/stores");
    expect(stores).toBeDefined();
    expect(isControlNavigationItemActive(stores!, "/control/stores/550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  test("visão geral é exata e não captura rotas filhas", () => {
    const overview = controlNavigation[0].items[0];
    expect(isControlNavigationItemActive(overview, "/control")).toBe(true);
    expect(isControlNavigationItemActive(overview, "/control/billing")).toBe(false);
  });

  test("planos comerciais e recursos usam a mesma rota real com estado navegável por query", () => {
    const plans = controlNavigation[2].items;
    expect(isControlNavigationItemActive(plans[0], "/control/plans", "/control/plans?section=plans")).toBe(true);
    expect(isControlNavigationItemActive(plans[0], "/control/plans", "/control/plans?section=resources")).toBe(false);
    expect(isControlNavigationItemActive(plans[1], "/control/plans", "/control/plans?section=resources")).toBe(true);
  });

  test("estado ativo acompanha a URL em navegação back/forward sem estado paralelo", () => {
    const items = controlNavigation.flatMap((group) => group.items);
    const billing = items.find((item) => item.to === "/control/billing")!;
    const domains = items.find((item) => item.to === "/control/domains")!;
    expect(isControlNavigationItemActive(billing, "/control/billing")).toBe(true);
    expect(isControlNavigationItemActive(billing, "/control/domains")).toBe(false);
    expect(isControlNavigationItemActive(domains, "/control/domains")).toBe(true);
    expect(isControlNavigationItemActive(billing, "/control/billing")).toBe(true);
  });

  test("todas as áreas solicitadas possuem destino de navegação", () => {
    const labels = controlNavigation.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual([
      "Visão geral",
      "Lojas",
      "Assinaturas e cobranças",
      "Planos comerciais",
      "Recursos e limites",
      "Identidade visual",
      "Domínios",
      "Meios de pagamento",
      "Equipe e acessos",
      "Auditoria",
    ]);
  });
});
