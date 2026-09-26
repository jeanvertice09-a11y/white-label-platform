export async function refreshInventoryViews(
  refreshInventory: () => Promise<void>,
  refreshHistory: () => Promise<void>,
): Promise<void> {
  const results = await Promise.allSettled([refreshInventory(), refreshHistory()]);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (rejected) {
    throw rejected.reason instanceof Error ? rejected.reason : new Error("Não foi possível atualizar a visão do estoque.");
  }
}
