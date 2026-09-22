import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const handlers = readFileSync(
  join(import.meta.dir, "..", "..", "apps", "worker", "src", "jobs", "handlers.ts"),
  "utf8",
);

describe("worker unimplemented jobs", () => {
  test("all placeholder handlers fail closed instead of reporting fake success", () => {
    expect(handlers).toContain("email.send");
    expect(handlers).toContain("media.process");
    expect(handlers).toContain("billing.reconcile");
    expect(handlers).toContain("domain.verify");
    expect(handlers.match(/Promise\.reject/g)?.length).toBe(1);
    expect(handlers).toContain("is not implemented; refusing fake success");
  });
});
