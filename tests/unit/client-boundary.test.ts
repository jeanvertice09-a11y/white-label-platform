import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Fronteira client/server executada: nenhum arquivo client do web pode
// importar módulo server-only nem referenciar service role.
const WEB_SRC = join(import.meta.dir, "..", "..", "apps", "web", "src");
// Normaliza separadores para / p/ funcionar cross-platform
const SERVER_ONLY_DIRS = ["lib/server", "auth/src/server"];
const SERVER_ONLY_PATTERNS = ["SUPABASE_SERVICE_ROLE_KEY", "service_role"];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function isServerOnlyFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return SERVER_ONLY_DIRS.some((d) => normalized.includes(d + "/") || normalized.endsWith("/" + d));
}

describe("client boundary (service role nunca no browser)", () => {
  test("arquivos client não importam server-only", () => {
    const bad: string[] = [];
    for (const f of files(WEB_SRC)) {
      if (isServerOnlyFile(f)) continue;
      const raw = readFileSync(f, "utf8");
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      for (const needle of SERVER_ONLY_PATTERNS) {
        if (src.includes(needle)) bad.push(`${f} :: ${needle}`);
      }
    }
    expect(bad).toEqual([]);
  });
  test("env pública de exemplo não contém segredo", () => {
    const example = readFileSync(join(import.meta.dir, "..", "..", ".env.example"), "utf8");
    for (const line of example.split("\n")) {
      if (line.startsWith("VITE_") && /SERVICE_ROLE|SECRET|PRIVATE/i.test(line)) {
        throw new Error(`segredo em env pública: ${line}`);
      }
    }
  });
});
