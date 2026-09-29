import { describe, expect, test } from "bun:test";
import { EMPTY_PUBLIC_STORE_PROFILE, readPublicStoreProfile } from "@white-label/catalog";

describe("public store profile", () => {
  test("expõe somente os campos públicos suportados", () => {
    const profile = readPublicStoreProfile({
      description: "Loja de bairro",
      phone: "(62) 99999-9999",
      public_email: "contato@example.com",
      address: "Centro",
      instagram: "@minhaloja",
      private_note: "não pode vazar",
      internal_token: "segredo",
    });
    expect(profile).toEqual({
      description: "Loja de bairro",
      phone: "(62) 99999-9999",
      publicEmail: "contato@example.com",
      address: "Centro",
      instagram: "minhaloja",
    });
    expect(profile).not.toHaveProperty("private_note");
    expect(profile).not.toHaveProperty("internal_token");
  });

  test("falha fechado para valores ausentes ou fora dos limites", () => {
    expect(readPublicStoreProfile(null)).toEqual(EMPTY_PUBLIC_STORE_PROFILE);
    expect(readPublicStoreProfile({ description: "x".repeat(1001), phone: 123 })).toEqual(EMPTY_PUBLIC_STORE_PROFILE);
  });
});
