import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("admin workflows lot 4", () => {
  test("produto expõe workflow de imagens real", () => {
    const route = source("apps/web/src/routes/admin.products.$id.tsx");
    const manager = source("apps/web/src/features/store-admin/product-image-manager.tsx");
    expect(route).toContain("<ProductImageManager product={data.product} />");
    expect(manager).toContain("createMerchantProductImage");
    expect(manager).toContain("setMerchantPrimaryProductImage");
    expect(manager).toContain("removeMerchantProductImage");
    expect(manager).toContain("Upload direto ainda não está disponível");
  });

  test("banner suporta edição e arquivamento sem criar outro sistema", () => {
    const manager = source("apps/web/src/features/store-admin/banner-manager.tsx");
    expect(manager).toContain("createMerchantBanner");
    expect(manager).toContain("updateMerchantBanner");
    expect(manager).toContain("Editar banner");
    expect(manager).toContain("Arquivar");
  });

  test("fornecedor suporta edição e preserva histórico por status", () => {
    const manager = source("apps/web/src/features/store-admin/merchant-suppliers-manager.tsx");
    const server = source("apps/web/src/lib/server/operations-merchant.functions.ts");
    expect(manager).toContain("updateMerchantSupplier");
    expect(manager).toContain("Arquivar");
    expect(server).toContain("repo.updateSupplier(current.scope");
  });

  test("tarefas expõem responsável, edição, conclusão e reabertura", () => {
    const route = source("apps/web/src/routes/admin.tasks.tsx");
    const manager = source("apps/web/src/features/store-admin/merchant-tasks-manager.tsx");
    expect(route).toContain("listMerchantTaskAssignees()");
    expect(manager).toContain("updateMerchantTask");
    expect(manager).toContain("setMerchantTaskStatus");
    expect(manager).toContain("Somente membros da equipe desta loja podem ser selecionados");
    expect(manager).toContain("Reabrir");
  });
});
