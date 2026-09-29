import { describe, expect, test } from "bun:test";
import { runGuardMatrix } from "../e2e/guard-matrix.ts";

// Matriz de autorização das rotas protegidas (fail closed).
// Cobre: visitante negado, tenant comum/support negados no /master,
// owner/admin permitidos, cross-tenant e cross-store negados.
describe("route guards (bloqueante)", () => {
  test("matriz de autorização fecha sem falhas", async () => {
    const r = await runGuardMatrix();
    expect(r.failures).toEqual([]);
    expect(r.failed).toBe(0);
    expect(r.passed).toBeGreaterThan(0);
  });
});
