import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const adminRoot = join(process.cwd(), "apps/web/src/admin");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

describe("admin source contract", () => {
  test("does not use legacy k classes", async () => {
    const files = (await filesUnder(adminRoot)).filter((file) => extname(file) === ".tsx");
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.includes('className="k-')).toBe(false);
    }
  });

  test("every CSS module reference exists in its sibling module", async () => {
    const files = (await filesUnder(adminRoot)).filter((file) => extname(file) === ".tsx");
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const importMatch = source.match(/import styles from "\.\/(.+\.module\.css)"/);
      const moduleName = importMatch?.[1];
      if (!moduleName) continue;
      const cssPath = join(file, "..", moduleName);
      const css = await readFile(cssPath, "utf8");
      const names = [...source.matchAll(/styles(?:\.([A-Za-z0-9_]+)|\["([A-Za-z0-9_-]+)"\])/g)];
      for (const match of names) {
        const name = match[1] || match[2];
        if (name) expect(css.includes(`.${name}`)).toBe(true);
      }
    }
  });
});
