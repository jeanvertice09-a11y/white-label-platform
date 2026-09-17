// E2E gate executável sem browser: roda a matriz de autorização real
// (loaders server-side usados pelas rotas) e falha se qualquer caso negar
// ou permitir incorretamente. Renderização no navegador: Playwright
// (tests/e2e/specs), requer `bunx playwright install`.
import { runGuardMatrix } from "./guard-matrix.ts";

const r = await runGuardMatrix();
if (r.failed > 0) {
  console.error(`[e2e] GUARD MATRIX FALHOU (${String(r.failed)}):`);
  for (const f of r.failures) console.error(`[e2e]  - ${f}`);
  process.exit(1);
}
console.warn(`[e2e] guard matrix ok: ${String(r.passed)} casos (deny-by-default verificado)`);
