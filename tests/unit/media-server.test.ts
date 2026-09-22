import { describe, expect, test } from "bun:test";
import type { StorageProvider, UploadIntentInput } from "@white-label/storage";
import {
  createMediaUploadIntent,
  deleteMediaAssetIfUnused,
  finalizeMediaUpload,
  requireMediaAsset,
} from "../../apps/web/src/lib/server/media.server.ts";
import type { MediaAsset, MediaSql } from "../../apps/web/src/lib/server/media.server.ts";

class FakeStorage implements StorageProvider {
  lastInput: UploadIntentInput | null = null;
  deleted: string[] = [];
  metadata = { contentType: "image/png", sizeBytes: 100 };

  async createUploadIntent(input: UploadIntentInput) {
    await Promise.resolve();
    this.lastInput = input;
    const store = input.storeId ? `/stores/${input.storeId}` : "";
    const objectKey = `tenants/${input.tenantId}${store}/${input.kind}/generated.png`;
    return { objectKey, uploadUrl: "https://upload.test/signed", publicUrl: `https://media.test/${objectKey}`, expiresAt: new Date(Date.now() + 600_000).toISOString() };
  }
  async inspectImageObject() { await Promise.resolve(); return this.metadata; }
  async deleteObject(objectKey: string) { await Promise.resolve(); this.deleted.push(objectKey); }
  getPublicUrl(objectKey: string) { return `https://media.test/${objectKey}`; }
}

class FakeSql implements MediaSql {
  asset: MediaAsset | null = null;
  usages = 0;

  async query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    await Promise.resolve();
    if (sql.includes("status='pending' and upload_expires_at < now()")) return [];
    if (sql.includes("insert into public.media_assets")) {
      this.asset = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: String(params[0]), storeId: typeof params[1] === "string" ? params[1] : null,
        objectKey: String(params[2]), publicUrl: String(params[3]), kind: params[4] as MediaAsset["kind"],
        contentType: String(params[5]), sizeBytes: Number(params[6]), status: "pending", uploadExpiresAt: String(params[7]),
      };
      return [{ id: this.asset.id }];
    }
    if (sql.includes("from public.media_assets") && sql.includes("id=$3::uuid")) {
      if (!this.asset) return [];
      const sameTenant = params[0] === this.asset.tenantId;
      const sameStore = (params[1] ?? null) === this.asset.storeId;
      const sameId = params[2] === this.asset.id;
      return sameTenant && sameStore && sameId ? [this.row()] : [];
    }
    if (sql.includes("as usages")) return [{ usages: this.usages }];
    if (sql.includes("set status='ready'")) { if (!this.asset) return []; this.asset.status = "ready"; return [this.row()]; }
    if (sql.includes("set status='failed'")) { if (this.asset) this.asset.status = "failed"; return []; }
    if (sql.includes("set status='delete_pending'")) { if (!this.asset) return []; this.asset.status = "delete_pending"; return [{ id: this.asset.id }]; }
    if (sql.includes("set status='deleted'")) { if (this.asset) this.asset.status = "deleted"; return []; }
    return [];
  }

  private row(): Record<string, unknown> {
    if (!this.asset) return {};
    return {
      id: this.asset.id, tenant_id: this.asset.tenantId, store_id: this.asset.storeId,
      object_key: this.asset.objectKey, public_url: this.asset.publicUrl, kind: this.asset.kind,
      content_type: this.asset.contentType, size_bytes: this.asset.sizeBytes,
      status: this.asset.status, upload_expires_at: this.asset.uploadExpiresAt,
    };
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  let rejection: unknown;
  try { await promise; } catch (error) { rejection = error; }
  if (!(rejection instanceof Error)) throw new Error("Expected promise to reject with Error");
  return rejection;
}

const scope = { tenantId: "11111111-1111-4111-8111-111111111111", storeId: "22222222-2222-4222-8222-222222222222" };
const actor = "33333333-3333-4333-8333-333333333333";

describe("media server lifecycle", () => {
  test("authorized upload uses only the server-derived scope and finalizes matching object metadata", async () => {
    const sql = new FakeSql(); const storage = new FakeStorage();
    const intent = await createMediaUploadIntent(sql, scope, actor, "product", { contentType: "image/png", sizeBytes: 100 }, storage);
    expect(storage.lastInput?.tenantId).toBe(scope.tenantId);
    expect(storage.lastInput?.storeId).toBe(scope.storeId);
    expect(intent.objectKey).toContain(`/stores/${scope.storeId}/product/`);
    const asset = await finalizeMediaUpload(sql, scope, intent.assetId, storage);
    expect(asset.status).toBe("ready");
  });

  test("IDOR scope cannot read an asset from another store or tenant", async () => {
    const sql = new FakeSql(); const storage = new FakeStorage();
    const intent = await createMediaUploadIntent(sql, scope, actor, "product", { contentType: "image/png", sizeBytes: 100 }, storage);
    await rejectionOf(requireMediaAsset(sql, { ...scope, storeId: "44444444-4444-4444-8444-444444444444" }, intent.assetId));
    await rejectionOf(requireMediaAsset(sql, { tenantId: "55555555-5555-4555-8555-555555555555", storeId: scope.storeId }, intent.assetId));
  });

  test("finalize rejects metadata mismatch and removes the physical object", async () => {
    const sql = new FakeSql(); const storage = new FakeStorage();
    const intent = await createMediaUploadIntent(sql, scope, actor, "banner", { contentType: "image/png", sizeBytes: 100 }, storage);
    storage.metadata = { contentType: "image/png", sizeBytes: 99 };
    const error = await rejectionOf(finalizeMediaUpload(sql, scope, intent.assetId, storage));
    expect(error.message).toContain("não corresponde");
    expect(sql.asset?.status).toBe("failed");
    expect(storage.deleted).toEqual([intent.objectKey]);
  });

  test("shared asset is never physically deleted while referenced", async () => {
    const sql = new FakeSql(); const storage = new FakeStorage();
    const intent = await createMediaUploadIntent(sql, scope, actor, "product", { contentType: "image/png", sizeBytes: 100 }, storage);
    await finalizeMediaUpload(sql, scope, intent.assetId, storage);
    sql.usages = 2;
    expect(await deleteMediaAssetIfUnused(sql, scope, intent.assetId, storage)).toBe(false);
    expect(storage.deleted).toEqual([]);
  });
});
