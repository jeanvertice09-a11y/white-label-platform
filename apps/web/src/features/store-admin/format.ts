export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function moneyToCents(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Valor inválido");
  return Math.round(parsed * 100);
}

export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "Pendente",
  processing: "Em processamento",
  paid: "Pago",
  approved: "Aprovado",
  completed: "Concluído",
  fulfilled: "Atendido",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  cancelled: "Cancelado",
  failed: "Falhou",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
  authorized: "Autorizado",
  rejected: "Recusado",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
