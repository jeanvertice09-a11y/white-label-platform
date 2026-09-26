import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./inventory-feedback.css", import.meta.url), "utf8");

describe("inventory feedback styles", () => {
  it("keeps mutation errors visually distinct", () => {
    expect(css).toContain(".k-inline-editor__message--error");
  });
});
