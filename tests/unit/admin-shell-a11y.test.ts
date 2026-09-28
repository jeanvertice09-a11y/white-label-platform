import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const shellPath = join(process.cwd(), "apps/web/src/admin/shell/AdminShell.tsx");

describe("admin shell accessibility", () => {
  test("preserves keyboard and mobile navigation contracts", async () => {
    const source = await readFile(shellPath, "utf8");
    expect(source).toContain("Ir para o conteúdo");
    expect(source).toContain('aria-controls="admin-navigation"');
    expect(source).toContain("aria-expanded={open}");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("opener.current?.focus()");
    expect(source).toContain('document.body.style.overflow = "hidden"');
  });
});
