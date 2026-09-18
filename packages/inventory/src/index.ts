export type {
  InventoryScope,
  StockMovementType,
  InventoryItem,
  StockAdjustmentInput,
} from "./types.ts";
export type {
  InventorySqlExecutor,
  InventoryRepository,
} from "./repository.ts";
export { createInventoryRepository } from "./postgres.ts";
