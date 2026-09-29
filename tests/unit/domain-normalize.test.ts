import { describe, expect, test } from "bun:test";
import { normalizeAndValidateHostname, normalizeHostname } from "../../packages/domains/src/normalize.ts";

describe("domain normalize", () => {
  test("lowercase, sem porta, sem trailing dot", () => {
    expect(normalizeHostname("Loja.EXAMPLE.com:5173/")).toBe("loja.example.com");
    expect(normalizeHostname("x.com.")).toBe("x.com");
  });
  test("hostname inválido rejeitado", () => {
    expect(() => normalizeAndValidateHostname("not a host!!")).toThrow();
    expect(() => normalizeAndValidateHostname("")).toThrow();
  });
});
