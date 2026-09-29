import { describe, expect, test } from "bun:test";
import { buildAuditEntry } from "../../packages/audit/src/sanitizer.ts";

describe("audit sanitizer", () => {
  test("remove senha, tokens, secrets, credentials, ciphertext e chaves recursivamente", () => {
    const entry = buildAuditEntry({
      actorUserId: "u1",
      tenantId: "t1",
      storeId: null,
      action: "login",
      resourceType: "session",
      resourceId: null,
      metadata: {
        password: "123",
        access_token: "abc",
        refresh_token: "r",
        api_key: "k",
        Authorization: "Bearer x",
        cookie: "c",
        webhook_secret: "s",
        credentials: { username: "visible", password: "hidden" },
        credential_ciphertext: "cv1.fake",
        encryption_key: "never-log",
        nested: { client_secret: "cs", credential: "raw", ok: 1 },
        list: [{ token: "x" }, { safe: true }],
      },
    });
    const metadata = entry.metadata ?? {};
    expect(metadata["password"]).toBe("[REDACTED]");
    expect(metadata["access_token"]).toBe("[REDACTED]");
    expect(metadata["Authorization"]).toBe("[REDACTED]");
    expect(metadata["credentials"]).toBe("[REDACTED]");
    expect(metadata["credential_ciphertext"]).toBe("[REDACTED]");
    expect(metadata["encryption_key"]).toBe("[REDACTED]");
    expect((metadata["nested"] as Record<string, unknown>)["client_secret"]).toBe("[REDACTED]");
    expect((metadata["nested"] as Record<string, unknown>)["credential"]).toBe("[REDACTED]");
    expect(((metadata["list"] as Record<string, unknown>[])[0])?.["token"]).toBe("[REDACTED]");
    expect((metadata["nested"] as Record<string, unknown>)["ok"]).toBe(1);
  });
});
