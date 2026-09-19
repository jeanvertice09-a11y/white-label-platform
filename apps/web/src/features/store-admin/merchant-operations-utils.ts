export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function parseMoneyToCents(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!normalized) return 0;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  const integerPart = separator >= 0 ? normalized.slice(0, separator) : normalized;
  const decimalPart = separator >= 0 ? normalized.slice(separator + 1) : "";
  const integerDigits = integerPart.replace(/\D/g, "") || "0";
  const decimalDigits = decimalPart.replace(/\D/g, "").padEnd(2, "0").slice(0, 2);
  const cents = Number(integerDigits) * 100 + Number(decimalDigits || "0");
  if (!Number.isSafeInteger(cents)) throw new Error("Valor monetário inválido");
  return cents;
}

export function today(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthRange(): { from: string; to: string } {
  const now = new Date();
  const fromYear = String(now.getFullYear());
  const from = `${fromYear}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toYear = String(end.getFullYear());
  const to = `${toYear}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return { from, to };
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

export function messageFrom(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
