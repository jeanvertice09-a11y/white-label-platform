import { describe, expect, test } from "bun:test";
import { assertAllowedCustomHostname, normalizeDomainRegistrationInput } from "@white-label/domains";

describe("domain registration normalization", () => {
  test("normaliza hostname e URL http(s) raiz", () => {
    expect(normalizeDomainRegistrationInput(" LOJA.EXEMPLO.COM ")).toBe("loja.exemplo.com");
    expect(normalizeDomainRegistrationInput("HTTPS://LOJA.EXEMPLO.COM/")).toBe("loja.exemplo.com");
  });

  test("rejeita path, query, porta e protocolo não suportado", () => {
    expect(() => normalizeDomainRegistrationInput("https://loja.exemplo.com/path")).toThrow();
    expect(() => normalizeDomainRegistrationInput("loja.exemplo.com?x=1")).toThrow();
    expect(() => normalizeDomainRegistrationInput("https://loja.exemplo.com:8443/")).toThrow();
    expect(() => normalizeDomainRegistrationInput("ftp://loja.exemplo.com")).toThrow();
  });

  test("rejeita hostname malformado e reservado Kataluu", () => {
    expect(() => normalizeDomainRegistrationInput("-invalido.example.com")).toThrow();
    expect(() => assertAllowedCustomHostname("app.kataluu.com.br")).toThrow();
    expect(() => assertAllowedCustomHostname("foo.billing.kataluu.com.br")).toThrow();
    expect(assertAllowedCustomHostname("app.customer.com")).toBe("app.customer.com");
  });
});
