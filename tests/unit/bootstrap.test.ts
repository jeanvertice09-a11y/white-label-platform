import { describe, expect, test } from "bun:test";
import { runBootstrap, validateBootstrapEnv } from "../../scripts/bootstrap.ts";

const good = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-key-abc123",
  TARGET_USER_ID: "11111111-1111-4111-8111-111111111111",
};

describe("bootstrap platform_owner", () => {
  test("recusa service key de exemplo", () => {
    expect(() => {
      validateBootstrapEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: "EXAMPLE_KEY" });
    }).toThrow();
  });
  test("recusa TARGET placeholder/curto", () => {
    expect(() => {
      validateBootstrapEnv({ ...good, TARGET_USER_ID: "EXAMPLE" });
    }).toThrow();
  });
  test("recusa produção sem confirmação explícita", () => {
    expect(() => {
      validateBootstrapEnv({ ...good, APP_ENV: "production" });
    }).toThrow();
  });
  test("sucesso faz POST idempotente com service key (fetch injetado)", async () => {
    const calls: { url: string; body: string; auth: string }[] = [];
    const r = await runBootstrap(good, async (url, init) => {
      await Promise.resolve();
      calls.push({ url, body: init.body, auth: init.headers["Authorization"] ?? "" });
      return { ok: true, status: 201 };
    });
    expect(r.targetUserId).toBe(good.TARGET_USER_ID);
    expect(calls.length).toBe(1);
    expect(calls[0]?.url.endsWith("/rest/v1/platform_members")).toBe(true);
    expect(calls[0]?.auth.startsWith("Bearer ")).toBe(true);
    expect(calls[0]?.body.includes("platform_owner")).toBe(true);
  });
  test("falha HTTP vira erro (sem sucesso inventado)", async () => {
    let threw = false;
    try {
      await runBootstrap(good, async () => {
        await Promise.resolve();
        return { ok: false, status: 401 };
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
