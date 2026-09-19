export interface MerchantScope {
  tenantId: string;
  storeId: string;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type SupplierStatus = "active" | "inactive";

export interface Supplier {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  tradeName?: string | null;
  document?: string | null;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type PurchaseStatus = "draft" | "received" | "cancelled";

export interface PurchaseItemInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitCostCents: number;
}

export interface PurchaseInput {
  supplierId: string | null;
  purchasedAt: string;
  discountCents: number;
  surchargeCents: number;
  notes?: string | null;
  items: PurchaseItemInput[];
}

export interface PurchaseItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitCostCents: number;
  subtotalCents: number;
}

export interface Purchase {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  purchasedAt: string;
  status: PurchaseStatus;
  subtotalCents: number;
  discountCents: number;
  surchargeCents: number;
  totalCents: number;
  notes: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: PurchaseItem[];
}

export type FinancialDirection = "receivable" | "payable";
export type FinancialStatus = "open" | "settled" | "cancelled";
export type FinancialCategoryDirection = "income" | "expense" | "both";

export interface FinancialCategory {
  id: string;
  name: string;
  direction: FinancialCategoryDirection;
  active: boolean;
}

export interface FinancialCategoryInput {
  name: string;
  direction: FinancialCategoryDirection;
}

export interface FinancialEntryInput {
  direction: FinancialDirection;
  categoryId: string | null;
  description: string;
  amountCents: number;
  dueAt: string;
  competenceDate: string;
  supplierId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  purchaseId?: string | null;
  notes?: string | null;
}

export interface FinancialEntry {
  id: string;
  direction: FinancialDirection;
  categoryId: string | null;
  categoryName: string | null;
  description: string;
  amountCents: number;
  dueAt: string;
  competenceDate: string;
  status: FinancialStatus;
  settledAt: string | null;
  supplierId: string | null;
  customerId: string | null;
  orderId: string | null;
  purchaseId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FinanceQuery extends PageQuery {
  direction?: FinancialDirection;
  status?: FinancialStatus;
  from?: string;
  to?: string;
}

export interface FinanceSummary {
  openReceivableCents: number;
  overdueReceivableCents: number;
  openPayableCents: number;
  overduePayableCents: number;
  receivedCents: number;
  paidCents: number;
  cashFlowCents: number;
  competenceReceivableCents: number;
  competencePayableCents: number;
  managerialResultCents: number;
}

export type MerchantTaskStatus = "open" | "done";
export type MerchantTaskPriority = "low" | "normal" | "high";

export interface MerchantTaskInput {
  title: string;
  description?: string | null;
  priority: MerchantTaskPriority;
  dueAt?: string | null;
  assigneeUserId?: string | null;
}

export interface MerchantTask {
  id: string;
  title: string;
  description: string | null;
  priority: MerchantTaskPriority;
  status: MerchantTaskStatus;
  dueAt: string | null;
  assigneeUserId: string | null;
  createdBy: string;
  completedAt: string | null;
  createdAt: string;
}

export interface MerchantOperationsSnapshot {
  suppliers: Page<Supplier>;
  purchases: Page<Purchase>;
  categories: FinancialCategory[];
  finance: Page<FinancialEntry>;
  financeSummary: FinanceSummary;
  tasks: MerchantTask[];
}
