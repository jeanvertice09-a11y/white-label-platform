import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(import.meta.dir, "..", "..", "apps", "web", "src");
const SERVER_ONLY_DIRS = ["lib/server", "auth/src/server"];
const SERVER_ONLY_PATTERNS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "GATEWAY_CREDENTIAL_VAULT_KEYS",
  "@white-label/payments/server",
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

function isServerOnlyFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return SERVER_ONLY_DIRS.some(
    (dir) => normalized.includes(`${dir}/`) || normalized.endsWith(`/${dir}`),
  );
}

describe("client boundary (segredos nunca no browser)", () => {
  test("arquivos client não importam/referenciam server-only", () => {
    const bad: string[] = [];
    for (const file of files(WEB_SRC)) {
      if (isServerOnlyFile(file)) continue;
      const raw = readFileSync(file, "utf8");
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      for (const needle of SERVER_ONLY_PATTERNS) {
        if (source.includes(needle)) bad.push(`${file} :: ${needle}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("env pública de exemplo não contém segredo", () => {
    const example = readFileSync(join(import.meta.dir, "..", "..", ".env.example"), "utf8");
    for (const line of example.split("\n")) {
      if (line.startsWith("VITE_") && /SERVICE_ROLE|SECRET|PRIVATE|VAULT/i.test(line)) {
        throw new Error(`segredo em env pública: ${line}`);
      }
    }
  });
});
