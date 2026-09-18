import type {
  InventoryHistoryPage,
  InventoryHistoryQuery,
  InventoryItem,
  InventoryPage,
  InventoryQuery,
  InventoryScope,
  StockOperationInput,
  StockOperationResult,
} from "./types.ts";

export interface InventorySqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface InventoryRepository {
  list(scope: InventoryScope): Promise<InventoryItem[]>;
  listPage(scope: InventoryScope, query: InventoryQuery): Promise<InventoryPage>;
  history(scope: InventoryScope, query?: InventoryHistoryQuery): Promise<InventoryHistoryPage>;
  move(scope: InventoryScope, input: StockOperationInput): Promise<StockOperationResult>;
}
