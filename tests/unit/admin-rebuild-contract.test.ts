import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "apps", "web", "src");
const admin = join(root, "admin");
const source = (name: string) => readFileSync(join(root, name), "utf8");

function adminFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? adminFiles(path) : [path];
  });
}

describe("admin rebuilt UI", () => {
  test("mobile navigation preserves focus and closes on Escape", () => {
    const shell = source("admin/shell/AdminShell.tsx");
    expect(shell).toContain('href="#admin-content"');
    expect(shell).toContain('aria-controls="admin-navigation"');
    expect(shell).toContain("aria-expanded={open}");
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain('event.key !== "Tab"');
    expect(shell).toContain("opener.current?.focus()");
    expect(shell).toContain('document.body.style.overflow = "hidden"');
  });

  test("new UI does not use placeholder plurals or text arrows", () => {
    const paths = adminFiles(admin).filter(path => path.endsWith(".tsx"));
    paths.push(join(root, "routes", "admin.index.tsx"));
    for (const path of paths) {
      const code = readFileSync(path, "utf8");
      expect(code).not.toMatch(/\((?:s|ns|ões)\)/);
      expect(code).not.toMatch(/[→↗⌄]/);
    }
  });
});
