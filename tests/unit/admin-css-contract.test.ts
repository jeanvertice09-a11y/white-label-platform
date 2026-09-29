import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = join(import.meta.dir, "..", "..", "apps", "web", "src");
const admin = join(root, "admin");

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function verifyModule(path: string): void {
  const code = readFileSync(path, "utf8");
  expect(code).not.toMatch(/className=["']k-/);
  const imports = [...code.matchAll(/import styles from ["']([^"']+\.module\.css)["']/g)];
  for (const [, relative] of imports) {
    const css = readFileSync(resolve(dirname(path), relative), "utf8");
    for (const [, name] of code.matchAll(/styles(?:\.([A-Za-z][\w]*)|\[["']([^"']+)["']\])/g)) {
      const key = name;
      expect(css).toContain(`.${key}`);
    }
  }
}

describe("admin CSS contract", () => {
  test("every referenced module class exists", () => {
    for (const path of files(admin).filter(path => path.endsWith(".tsx"))) verifyModule(path);
    verifyModule(join(root, "routes", "admin.index.tsx"));
  });

  test("new admin code has readable lines", () => {
    for (const path of files(admin).filter(path => /\.(tsx|ts|css)$/.test(path))) {
      const lines = readFileSync(path, "utf8").split("\n");
      for (const [index, line] of lines.entries()) {
        expect(line.length, `${path}:${String(index + 1)}`).toBeLessThanOrEqual(110);
      }
    }
  });
});
