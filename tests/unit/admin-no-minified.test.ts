import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "apps/web/src/admin");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

describe("admin formatting", () => {
  test("keeps every source line at 110 characters or fewer", async () => {
    for (const file of await filesUnder(root)) {
      if (!/\.(?:ts|tsx|css)$/.test(file)) continue;
      const lines = (await readFile(file, "utf8")).split("\n");
      lines.forEach((line, index) => {
        const position = `${file}:${String(index + 1)} ${String(line.length)}`;
        expect(position).toSatisfy(() => line.length <= 110);
      });
    }
  });
});
