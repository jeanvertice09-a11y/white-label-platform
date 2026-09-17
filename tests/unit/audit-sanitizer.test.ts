import { describe, expect, test } from "bun:test";
import { buildAuditEntry } from "../../packages/audit/src/sanitizer.ts";

describe("audit sanitizer", () => {
  test("remove senha, tokens, secrets e cookies", () => {
    const e = buildAuditEntry({
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
        nested: { client_secret: "cs", ok: 1 },
      },
    });
    const m = e.metadata!;
    expect(m["password"]).toBe("[REDACTED]");
    expect(m["access_token"]).toBe("[REDACTED]");
    expect(m["Authorization"]).toBe("[REDACTED]");
    expect((m["nested"] as Record<string, unknown>)["client_secret"]).toBe("[REDACTED]");
    expect((m["nested"] as Record<string, unknown>)["ok"]).toBe(1);
  });
});
