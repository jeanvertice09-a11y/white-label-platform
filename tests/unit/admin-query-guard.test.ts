import { describe, expect, test } from "bun:test";
import {
  AdminQueryTimeoutError,
  createAdminQueryGuard,
} from "../../apps/web/src/lib/server/admin-query-guard.server.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("admin query guard", () => {
  test("query pendente expira e libera a próxima operação", async () => {
    const guard = createAdminQueryGuard(25);
    let timeoutCalls = 0;
    let secondStarted = false;

    const stuck = guard.run(
      () => new Promise<never>(() => undefined),
      () => {
        timeoutCalls += 1;
      },
    );
    const second = guard.run(async () => {
      secondStarted = true;
      return "ok";
    });

    await expect(stuck).rejects.toBeInstanceOf(AdminQueryTimeoutError);
    expect(await second).toBe("ok");
    expect(timeoutCalls).toBe(1);
    expect(secondStarted).toBe(true);
  });

  test("operações concorrentes são serializadas para pool max:1", async () => {
    const guard = createAdminQueryGuard(250);
    let inFlight = 0;
    let maxInFlight = 0;

    const operation = async (): Promise<void> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(15);
      inFlight -= 1;
    };

    await Promise.all([
      guard.run(operation),
      guard.run(operation),
      guard.run(operation),
    ]);

    expect(maxInFlight).toBe(1);
  });

  test("timeout inválido falha na criação do guard", () => {
    expect(() => createAdminQueryGuard(0)).toThrow(RangeError);
    expect(() => createAdminQueryGuard(Number.NaN)).toThrow(RangeError);
  });
});
