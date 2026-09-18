export function numberValue(row: Record<string, unknown>, key: string): number {
  return Number(row[key] ?? 0);
}

function stringifyDbValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  throw new Error("Valor do banco inválido");
}

export function stringValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : stringifyDbValue(value);
}

export function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return value === null || value === undefined ? null : stringifyDbValue(value);
}
