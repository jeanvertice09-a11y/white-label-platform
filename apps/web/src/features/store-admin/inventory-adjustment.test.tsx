import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./inventory-adjustment.tsx", import.meta.url), "utf8");

describe("inventory adjustment mutation integrity", () => {
  it("refreshes inventory before resetting the form and publishing success", () => {
    const refresh = source.indexOf("await props.onCompleted()");
    const reset = source.indexOf("target.reset()", refresh);
    const success = source.indexOf('kind: "success"', reset);

    expect(refresh).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(refresh);
    expect(success).toBeGreaterThan(reset);
  });

  it("keeps failures visually and semantically distinct from success", () => {
    expect(source).toContain('kind: "error"');
    expect(source).toContain('role={feedback.kind === "error" ? "alert" : "status"}');
    expect(source).toContain('k-inline-editor__message--error');
  });

  it("guards against duplicate submissions while a mutation is running", () => {
    expect(source).toContain("if (busy) return;");
    expect(source).toContain('disabled={busy} type="submit"');
  });
});
