import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

describe("admin inventory mutation integrity", () => {
  test("refreshes inventory before clearing the form and publishing success", () => {
    const adjustment = source("apps/web/src/features/store-admin/inventory-adjustment.tsx");
    const refresh = adjustment.indexOf("await props.onCompleted()");
    const reset = adjustment.indexOf("target.reset()", refresh);
    const success = adjustment.indexOf('kind: "success"', reset);

    expect(refresh).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(refresh);
    expect(success).toBeGreaterThan(reset);
  });

  test("blocks duplicate mutations and distinguishes failure feedback", () => {
    const adjustment = source("apps/web/src/features/store-admin/inventory-adjustment.tsx");
    expect(adjustment).toContain("if (busy) return;");
    expect(adjustment).toContain('disabled={busy} type="submit"');
    expect(adjustment).toContain('kind: "error"');
    expect(adjustment).toContain('role={feedback.kind === "error" ? "alert" : "status"}');
  });

  test("ships the error style through the component import", () => {
    const adjustment = source("apps/web/src/features/store-admin/inventory-adjustment.tsx");
    const css = source("apps/web/src/styles/inventory-feedback.css");
    expect(adjustment).toContain('import "../../styles/inventory-feedback.css"');
    expect(css).toContain(".k-inline-editor__message--error");
  });
});
