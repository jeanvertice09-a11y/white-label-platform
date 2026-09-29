export function masterMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function masterDate(value: string): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}
