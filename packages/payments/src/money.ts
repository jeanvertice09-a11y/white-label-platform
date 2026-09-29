// Dinheiro SEMPRE em centavos (inteiro). Nunca float.
export type Cents = number & { readonly __brand: "Cents" };

export function toCents(reais: number): Cents {
  if (!Number.isFinite(reais) || reais < 0) throw new Error("Valor inválido");
  return Math.round(reais * 100) as Cents;
}

export function centsToReais(c: Cents): number {
  return c / 100;
}

export function assertIntegerCents(value: number): asserts value is Cents {
  if (!Number.isInteger(value) || value < 0) throw new Error("Cents deve ser inteiro >= 0");
}
