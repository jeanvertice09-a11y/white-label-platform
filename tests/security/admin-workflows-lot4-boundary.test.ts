import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("admin workflows lot 4 security boundary", () => {
  test("imagens de produto preservam ownership de tenant, loja e produto", () => {
    const writer = source("packages/catalog/src/postgres-write-images.ts");
    expect(writer).toContain("assertKeyBelongsToStore(input.objectKey, scope.tenantId, scope.storeId)");
    expect(writer).toContain("tenant_id=$1 and store_id=$2 and id=$3::uuid");
    expect(writer).toContain("tenant_id=$1 and store_id=$2 and product_id=$3::uuid and id=$4::uuid");
    expect(writer).not.toContain("delete from public.products");
  });

  test("banners continuam validando chave de mídia da loja", () => {
    const writer = source("packages/catalog/src/postgres-write-store.ts");
    expect(writer.match(/assertKeyBelongsToStore\(input\.imageObjectKey, scope\.tenantId, scope\.storeId\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(writer).not.toContain("delete from public.store_banners");
  });

  test("fornecedores usam update e status escopados sem hard delete", () => {
    const suppliers = source("packages/merchant-ops/src/suppliers.ts");
    expect(suppliers).toContain("where tenant_id=$1 and store_id=$2 and id=$3::uuid returning *");
    expect(suppliers).toContain("set status=$4,updated_at=now()");
    expect(suppliers).not.toContain("delete from public.merchant_suppliers");
  });

  test("tarefas e assignee permanecem limitados à loja autenticada", () => {
    const tasks = source("packages/merchant-ops/src/tasks.ts");
    const functions = source("apps/web/src/lib/server/operations-merchant.functions.ts");
    expect(tasks).toContain("where tenant_id=$1 and store_id=$2 and id=$3::uuid returning *");
    expect(tasks).not.toContain("delete from public.merchant_tasks");
    expect(functions).toContain("from public.store_members");
    expect(functions).toContain("tenant_id=$1::uuid and store_id=$2::uuid and user_id=$3::uuid");
    expect(functions.match(/await assertTaskAssignee\(current\.sql, current\.scope,/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("telas não enviam tenantId, storeId ou role como autoridade", () => {
    const files = [
      "apps/web/src/features/store-admin/product-image-manager.tsx",
      "apps/web/src/features/store-admin/banner-manager.tsx",
      "apps/web/src/features/store-admin/merchant-suppliers-manager.tsx",
      "apps/web/src/features/store-admin/merchant-tasks-manager.tsx",
      "apps/web/src/routes/admin.products.$id.tsx",
      "apps/web/src/routes/admin.tasks.tsx",
    ];
    for (const path of files) {
      const file = source(path);
      expect(file).not.toContain("tenantId:");
      expect(file).not.toContain("storeId:");
      expect(file).not.toContain("role:");
    }
  });

  test("operações destrutivas preferem associação/status seguro", () => {
    const images = source("apps/web/src/lib/server/catalog-admin.functions.ts");
    const suppliers = source("apps/web/src/features/store-admin/merchant-suppliers-manager.tsx");
    const tasks = source("apps/web/src/features/store-admin/merchant-tasks-manager.tsx");
    const banners = source("apps/web/src/features/store-admin/banner-manager.tsx");
    expect(images).toContain('"product.image.detached"');
    expect(images).toContain("physical_object_deleted: false");
    expect(suppliers).toContain("Arquivar este fornecedor?");
    expect(tasks).toContain('status: next');
    expect(banners).toContain("Arquivar este banner?");
  });
});
