import type {
  InventoryItem,
  InventoryScope,
  StockAdjustmentInput,
} from "./types.ts";

export interface InventorySqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface InventoryRepository {
  list(scope: InventoryScope): Promise<InventoryItem[]>;
  adjust(scope: InventoryScope, input: StockAdjustmentInput): Promise<number>;
}
