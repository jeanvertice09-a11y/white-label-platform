import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) {
      if (path.includes(`${join("lib", "server")}`)) continue;
      out.push(...sourceFiles(path));
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("Vercel domain secret boundary", () => {
  test("token e cliente Vercel não aparecem no source client-side", () => {
    const webRoot = join(import.meta.dir, "..", "..", "apps", "web", "src");
    const files = sourceFiles(webRoot);
    const content = files.map((path) => readFileSync(path, "utf8")).join("\n");
    expect(content).not.toContain("VERCEL_API_TOKEN");
    expect(content).not.toContain("Authorization: `Bearer ${token}`");
    expect(content).not.toContain("vercel-domain-provisioner.server");
  });
});
