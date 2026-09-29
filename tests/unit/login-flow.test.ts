import { describe, expect, test } from "bun:test";
import { parseLoginSearch, postLoginLocation } from "../../apps/web/src/lib/login-flow.ts";

describe("login flow", () => {
  test("onboarding aceita valores JSON do TanStack e mantém estado true", () => {
    expect(parseLoginSearch({ onboarding: 1 })).toEqual({ onboarding: true });
    expect(parseLoginSearch({ onboarding: true })).toEqual({ onboarding: true });
    expect(parseLoginSearch({ onboarding: "1" })).toEqual({ onboarding: true });
    expect(parseLoginSearch({ onboarding: "true" })).toEqual({ onboarding: true });
  });

  test("onboarding false ou ausente não vira estado false serializável", () => {
    expect(parseLoginSearch({ onboarding: false })).toEqual({ onboarding: undefined });
    expect(parseLoginSearch({ onboarding: "false" })).toEqual({ onboarding: undefined });
    expect(parseLoginSearch({})).toEqual({ onboarding: undefined });
  });

  test("dono da White Label volta ao login somente para carregar onboarding autenticado", () => {
    expect(postLoginLocation("/control")).toBe("/login?onboarding=true");
    expect(postLoginLocation("/master")).toBe("/master");
    expect(postLoginLocation("/admin")).toBe("/admin");
  });
});
