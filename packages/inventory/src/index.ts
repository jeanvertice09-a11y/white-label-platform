export type {
  InventoryScope,
  StockMovementType,
  StockOperationKind,
  InventoryItem,
  InventoryQuery,
  InventoryPage,
  StockOperationInput,
  StockOperationResult,
  InventoryMovement,
  InventoryHistoryQuery,
  InventoryHistoryPage,
} from "./types.ts";
export type {
  InventorySqlExecutor,
  InventoryRepository,
} from "./repository.ts";
export { createInventoryRepository } from "./postgres.ts";
export {
  orderStockSqlFragments,
} from "./order-stock.ts";
export type {
  OrderStockSqlFragments,
} from "./order-stock.ts";
