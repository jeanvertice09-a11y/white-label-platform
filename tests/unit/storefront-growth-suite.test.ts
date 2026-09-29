import { describe, expect, test } from "bun:test";
import {
  createCatalogReadRepository,
  getCatalogTrackingSettings,
  mergeCatalogTrackingLabels,
} from "../../packages/catalog/src/index.ts";
import type { CatalogSqlExecutor } from "../../packages/catalog/src/repository.ts";

describe("storefront growth suite", () => {
  test("tracking lê somente IDs públicos válidos e preserva isolamento em labels da loja", () => {
    const labels = mergeCatalogTrackingLabels({ subtitle: "Loja" }, {
      metaPixelId: "123456789012345",
      ga4MeasurementId: "G-ABC1234567",
      tiktokPixelId: "C123456789ABCDE",
    });
    expect(labels["subtitle"]).toBe("Loja");
    expect(getCatalogTrackingSettings({ labels })).toEqual({
      metaPixelId: "123456789012345",
      ga4MeasurementId: "G-ABC1234567",
      tiktokPixelId: "C123456789ABCDE",
    });
    expect(getCatalogTrackingSettings({ labels: {
      tracking_meta_pixel_id: "<script>",
      tracking_ga4_measurement_id: "UA-LEGACY",
      tracking_tiktok_pixel_id: "bad value",
    } })).toEqual({ metaPixelId: null, ga4MeasurementId: null, tiktokPixelId: null });
  });

  test("busca pública cobre SKU de variante ativa sem sair do tenant/store", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = { query(statement, params) { calls.push({ sql: statement, params }); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql);
    await repository.listProducts({ tenantId: "tenant-a", storeId: "store-a", page: 1, pageSize: 20, search: "SKU-VAR" }, true);
    const call = calls[0];
    expect(call.params.slice(0, 3)).toEqual(["tenant-a", "store-a", "%SKU-VAR%"]);
    expect(call.sql).toContain("from public.product_variants ssv");
    expect(call.sql).toContain("ssv.tenant_id=p.tenant_id");
    expect(call.sql).toContain("ssv.store_id=p.store_id");
    expect(call.sql).toContain("ssv.active=true");
    expect(call.sql).toContain("coalesce(ssv.sku,'') ilike $3");
  });

  test("revalidação por ID pode exigir o mesmo filtro público do catálogo", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = { query(statement, params) { calls.push({ sql: statement, params }); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql);
    await repository.getProductById({ tenantId: "tenant-a", storeId: "store-a" }, "product-a", true);
    const call = calls[0];
    expect(call.params).toEqual(["tenant-a", "store-a", "product-a"]);
    expect(call.sql).toContain("p.active=true");
    expect(call.sql).toContain("c.tenant_id=p.tenant_id");
    expect(call.sql).toContain("pc.active=true");
  });
});
