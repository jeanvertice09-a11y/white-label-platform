import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("media upload security boundary", () => {
  test("merchant upload derives tenant/store server-side and accepts no path authority", () => {
    const fn = source("apps/web/src/lib/server/media.functions.ts");
    expect(fn).toContain("createMerchantCatalogContext(getRequestHost())");
    expect(fn).toContain("ctx.scope");
    expect(fn).not.toContain("tenantId: z.");
    expect(fn).not.toContain("storeId: z.");
    expect(fn).not.toContain("objectKey: z.");
  });

  test("control logo derives tenant from authorized control context", () => {
    const fn = source("apps/web/src/lib/server/control-media.functions.ts");
    expect(fn).toContain("controlMerchantMutation()");
    expect(fn).toContain("const scope = { tenantId: ctx.tenantId }");
    expect(fn).not.toContain("tenantId: z.");
  });

  test("finalize verifies stored MIME, size and binary signature", () => {
    const r2 = source("packages/storage/src/r2.ts");
    const media = source("apps/web/src/lib/server/media.server.ts");
    expect(r2).toContain("method: \"HEAD\"");
    expect(r2).toContain("bytes=0-15");
    expect(r2).toContain("assertImageSignature");
    expect(media).toContain("metadata.contentType !== asset.contentType");
    expect(media).toContain("metadata.sizeBytes !== asset.sizeBytes");
  });

  test("R2 credentials stay server-only", () => {
    const server = source("packages/storage/src/r2.ts");
    const client = source("apps/web/src/lib/media-upload.ts");
    expect(server).toContain("R2_SECRET_ACCESS_KEY");
    expect(client).not.toContain("R2_SECRET_ACCESS_KEY");
    expect(client).not.toContain("R2_ACCESS_KEY_ID");
    expect(client).not.toContain("R2_ACCOUNT_ID");
  });

  test("database binds associations only to ready scoped assets and keeps RLS deny-by-default", () => {
    const migration = source("supabase/migrations/0030_media_assets.sql");
    expect(migration).toContain("create or replace function public.bind_store_media_asset()");
    expect(migration).toContain("a.kind = expected_kind");
    expect(migration).toContain("a.status = 'ready'");
    expect(migration).toContain("a.object_key = expected_key");
    expect(migration).toContain("foreign key (tenant_id, store_id, asset_id)");
    expect(migration).toContain("create or replace function public.validate_tenant_logo_asset()");
    expect(migration).toContain("alter table public.media_assets enable row level security");
  });

  test("physical deletion checks every supported reference before R2 delete", () => {
    const media = source("apps/web/src/lib/server/media.server.ts");
    const migration = source("supabase/migrations/0032_media_deletion_claim.sql");
    expect(media).toContain("public.claim_media_asset_deletion");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("public.product_images");
    expect(migration).toContain("public.store_banners");
    expect(migration).toContain("public.tenant_branding");
  });

  test("abandoned finalized assets are collected only after a grace period and with zero references", () => {
    const cleanup = source("apps/web/src/lib/server/media-orphan-cleanup.server.ts");
    expect(cleanup).toContain("m.created_at < now() - interval '24 hours'");
    expect(cleanup).toContain("not exists (select 1 from public.product_images");
    expect(cleanup).toContain("not exists (select 1 from public.store_banners");
    expect(cleanup).toContain("not exists (select 1 from public.tenant_branding");
    expect(cleanup).toContain("deleteMediaAssetIfUnused");
  });

  test("merchant media association routes are authorization-scoped and reject foreign asset IDs", () => {
    const association = source("apps/web/src/lib/server/media-association.functions.ts");
    expect(association).toContain("createMerchantCatalogContext(getRequestHost())");
    expect(association).toContain("requireMediaAsset(ctx.sql, ctx.scope, assetId)");
    expect(association).toContain("asset.kind !== kind || asset.status !== \"ready\"");
    expect(association).not.toContain("tenantId: z.");
    expect(association).not.toContain("storeId: z.");
  });
});
