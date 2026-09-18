export interface InventoryScope {
  tenantId: string;
  storeId: string;
}

export type StockMovementType =
  | "initial"
  | "purchase"
  | "sale"
  | "adjustment"
  | "return"
  | "cancellation"
  | "manual";

export interface InventoryItem extends InventoryScope {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  trackInventory: boolean;
  currentQuantity: number;
}

export interface StockAdjustmentInput {
  productId: string;
  variantId: string | null;
  delta: number;
  type: Extract<StockMovementType, "initial" | "purchase" | "adjustment" | "return" | "manual">;
  reason: string;
  createdBy: string | null;
}
