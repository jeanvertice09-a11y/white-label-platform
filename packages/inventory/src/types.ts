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

export type StockOperationKind = "entry" | "exit" | "set";

export interface InventoryItem extends InventoryScope {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  trackInventory: boolean;
  currentQuantity: number;
}

export interface InventoryQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface InventoryPage {
  items: InventoryItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface StockOperationInput {
  operationId: string;
  productId: string;
  variantId: string | null;
  kind: StockOperationKind;
  quantity: number;
  reason: string;
  createdBy: string | null;
}

export interface StockOperationResult {
  currentQuantity: number;
  delta: number;
  applied: boolean;
}

export interface InventoryMovement extends InventoryScope {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  delta: number;
  movementType: StockMovementType;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface InventoryHistoryQuery {
  page: number;
  pageSize: number;
  search?: string;
  movementType?: StockMovementType;
}

export interface InventoryHistoryPage {
  items: InventoryMovement[];
  page: number;
  pageSize: number;
  total: number;
}
