export type InventoryFeedback = Readonly<{
  kind: "success" | "error";
  message: string;
}> | null;

export function inventoryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível movimentar ou atualizar o estoque.";
}
