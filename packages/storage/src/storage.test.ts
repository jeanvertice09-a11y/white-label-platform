import { describe, expect, test } from "bun:test";
import {
  MAX_UPLOAD_BYTES,
  assertImageSignature,
  assertUploadAllowed,
  buildObjectKey,
} from "./index.ts";
import { R2StorageConfigurationError, createR2StorageProvider } from "./server.ts";

describe("media storage security", () => {
  test("rejects invalid MIME and oversized files", () => {
    expect(() => { assertUploadAllowed("image/svg+xml", 100); }).toThrow();
    expect(() => { assertUploadAllowed("image/png", MAX_UPLOAD_BYTES + 1); }).toThrow();
    expect(() => { assertUploadAllowed("image/png", 0); }).toThrow();
  });

  test("validates real image signatures", () => {
    expect(() => { assertImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"); }).not.toThrow();
    expect(() => { assertImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"); }).not.toThrow();
    expect(() => { assertImageSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"); }).not.toThrow();
    expect(() => { assertImageSignature(new TextEncoder().encode("<svg>bad</svg>"), "image/png"); }).toThrow();
  });

  test("builds unpredictable scoped keys and rejects path-like extensions", () => {
    const first = buildObjectKey({ tenantId: "TENANT-A", storeId: "STORE-A", kind: "product", extension: "jpg" });
    const second = buildObjectKey({ tenantId: "TENANT-A", storeId: "STORE-A", kind: "product", extension: "jpg" });
    expect(first).toMatch(/^tenants\/tenant-a\/stores\/store-a\/product\/[0-9a-f-]+\.jpg$/);
    expect(second).not.toBe(first);
    expect(first).not.toContain("minha-foto");
    expect(() => { buildObjectKey({ tenantId: "tenant", storeId: "store", kind: "product", extension: "../png" }); }).toThrow();
  });

  test("fails closed when R2 configuration is absent", () => {
    expect(() => { createR2StorageProvider({}); }).toThrow(R2StorageConfigurationError);
  });

  test("presigns upload without exposing the secret key", async () => {
    const provider = createR2StorageProvider({
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "super-secret-never-client",
      R2_BUCKET_MEDIA: "media",
      R2_PUBLIC_BASE_URL: "https://media.example.test",
    });
    const intent = await provider.createUploadIntent({
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      kind: "banner",
      contentType: "image/webp",
      sizeBytes: 1024,
    });
    expect(intent.objectKey).toContain("/banner/");
    expect(intent.objectKey.endsWith(".webp")).toBe(true);
    expect(intent.uploadUrl).toContain("X-Amz-Signature=");
    expect(intent.uploadUrl).not.toContain("super-secret-never-client");
    expect(intent.publicUrl.startsWith("https://media.example.test/tenants/")).toBe(true);
  });
});
