import { describe, expect, test } from "bun:test";
import type { SqlExecutor } from "@white-label/domains";
import { enforceRateLimit, RateLimitError } from "../../apps/web/src/lib/server/rate-limit.server.ts";

describe("security rate limit", () => {
  test("consome contador persistente com chave estável server-side", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const executor: SqlExecutor = {
      query(sql, params) {
        calls.push({ sql, params });
        return Promise.resolve([{ allowed: true }]);
      },
    };
    await enforceRateLimit(executor, "checkout:tenant-a:store-a", 30, 60);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("consume_security_rate_limit");
    expect(calls[0]?.params).toEqual(["checkout:tenant-a:store-a", 30, 60]);
  });

  test("nega deterministicamente quando a função atômica retorna false", async () => {
    const executor: SqlExecutor = { query: () => Promise.resolve([{ allowed: false }]) };
    let caught: unknown = null;
    try { await enforceRateLimit(executor, "webhook:asaas:account-a", 120, 60); }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(RateLimitError);
  });

  test("rejeita chave manipulável fora do formato antes do banco", async () => {
    let queried = false;
    const executor: SqlExecutor = { query: () => { queried = true; return Promise.resolve([]); } };
    let caught: unknown = null;
    try { await enforceRateLimit(executor, "bad key ?", 10, 60); }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("Chave de rate limit inválida.");
    expect(queried).toBe(false);
  });
});
