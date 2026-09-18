import type { CustomerMutationInput, CustomerScope } from "./types.ts";

export function normalizeCustomerPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw new Error("Telefone inválido");
  return digits;
}

export function assertCustomerScope(scope: CustomerScope): void {
  if (!scope.tenantId || !scope.storeId) throw new Error("Escopo de cliente inválido");
}

export function normalizeCustomerInput(input: CustomerMutationInput): CustomerMutationInput {
  const name = input.name.trim();
  if (!name || name.length > 160) throw new Error("Nome inválido");
  const email = input.email?.trim().toLowerCase() || null;
  if (email && email.length > 254) throw new Error("E-mail inválido");
  const document = input.document?.trim() || null;
  if (document && document.length > 40) throw new Error("Documento inválido");
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 2000) throw new Error("Observação inválida");
  return {
    name,
    phone: normalizeCustomerPhone(input.phone),
    email,
    document,
    birthDate: input.birthDate,
    notes,
  };
}
