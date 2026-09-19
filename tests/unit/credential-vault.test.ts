import { describe, expect, test } from "bun:test";
import {
  createCredentialVaultFromEnv,
  createCredentialVaultFromKeyring,
} from "../../packages/payments/src/server/credential-vault.ts";

function encoded(byte: number): string {
  return Buffer.alloc(32, byte).toString("base64");
}

function tamperCiphertext(envelope: string): string {
  const parts = envelope.split(".");
  const ciphertext = Buffer.from(parts[4] ?? "", "base64url");
  if (ciphertext.length === 0) throw new Error("Fixture de ciphertext inválida");
  ciphertext[0] ^= 1;
  parts[4] = ciphertext.toString("base64url");
  return parts.join(".");
}

describe("CredentialVault", () => {
  test("encrypta e descriptografa sem manter plaintext no envelope", () => {
    const vault = createCredentialVaultFromKeyring({ "1": encoded(7) });
    const plaintext = "fixture-credential-not-real";
    const ciphertext = vault.encrypt(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.startsWith("cv1.1.")).toBe(true);
    expect(vault.decrypt(ciphertext)).toBe(plaintext);
  });

  test("keyring versionado usa a versão mais nova e mantém leitura antiga", () => {
    const oldVault = createCredentialVaultFromKeyring({ "1": encoded(1) });
    const oldCiphertext = oldVault.encrypt("old-fixture");
    const rotated = createCredentialVaultFromKeyring({
      "1": encoded(1),
      "2": encoded(2),
    });
    expect(rotated.decrypt(oldCiphertext)).toBe("old-fixture");
    expect(rotated.encrypt("new-fixture").startsWith("cv1.2.")).toBe(true);
  });

  test("ciphertext adulterado é rejeitado", () => {
    const vault = createCredentialVaultFromKeyring({ "1": encoded(3) });
    const ciphertext = vault.encrypt("tamper-fixture");
    const tampered = tamperCiphertext(ciphertext);
    expect(() => vault.decrypt(tampered)).toThrow("Credencial protegida inválida");
  });

  test("chave ausente falha fechada", () => {
    expect(() => createCredentialVaultFromEnv({})).toThrow(
      "CredentialVault não configurado corretamente",
    );
  });

  test("chave inválida é rejeitada", () => {
    expect(() => createCredentialVaultFromEnv({
      GATEWAY_CREDENTIAL_VAULT_KEYS: JSON.stringify({ "1": "not-a-valid-key" }),
    })).toThrow("CredentialVault não configurado corretamente");
  });
});
