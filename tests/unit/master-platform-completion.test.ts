import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> { return Bun.file(path).text(); }

describe("master platform completion", () => {
  test("White Labels possuem detalhe operacional usando o backend real", async () => {
    const route = await source("apps/web/src/routes/master.platforms.tsx");
    const detail = await source("apps/web/src/features/master/master-white-label-detail.tsx");
    expect(route).toContain("getMasterWhiteLabel");
    expect(route).toContain("loaderDeps");
    expect(route).toContain("tenantId: tenant.id");
    expect(detail).toContain("MasterWhiteLabelDetailForm");
    expect(detail).toContain("MasterPlatformBillingPanel");
    expect(detail).toContain("MasterWhiteLabelDomainManager");
    expect(detail).toContain("detail.stores");
    expect(detail).toContain("detail.members");
    expect(detail).toContain("detail.audits");
  });

  test("configurações expõem somente entitlements reais e mantêm placeholders honestos", async () => {
    const route = await source("apps/web/src/routes/master.settings.tsx");
    const manager = await source("apps/web/src/features/master/master-plan-entitlements-manager.tsx");
    expect(route).toContain("getPlatformPlanTemplates");
    expect(route).toContain("MasterPlanEntitlementsManager");
    expect(route).toContain("Sem backend configurado");
    expect(manager).toContain("savePlatformTemplateEntitlements");
    expect(manager).toContain("template.entitlements.map");
    expect(manager).not.toContain("tenantId");
    expect(manager).not.toContain("storeId");
  });

  test("suporte continua indisponível quando não existe modelo real", async () => {
    const support = await source("apps/web/src/routes/master.support.tsx");
    expect(support).toContain("Fonte de chamados ainda não conectada");
  });
});
