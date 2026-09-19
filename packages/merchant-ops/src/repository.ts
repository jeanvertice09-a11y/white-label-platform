import type {
  FinanceQuery,
  FinanceSummary,
  FinancialCategory,
  FinancialCategoryInput,
  FinancialEntry,
  FinancialEntryInput,
  MerchantScope,
  MerchantTask,
  MerchantTaskInput,
  Page,
  PageQuery,
  Purchase,
  PurchaseInput,
  Supplier,
  SupplierInput,
  SupplierStatus,
} from "./types.ts";

export interface MerchantOpsSqlExecutor {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface MerchantOperationsRepository {
  listSuppliers(scope: MerchantScope, query: PageQuery): Promise<Page<Supplier>>;
  createSupplier(scope: MerchantScope, input: SupplierInput): Promise<Supplier>;
  updateSupplierStatus(scope: MerchantScope, supplierId: string, status: SupplierStatus): Promise<Supplier>;
  listPurchases(scope: MerchantScope, query: PageQuery): Promise<Page<Purchase>>;
  createPurchase(scope: MerchantScope, input: PurchaseInput, actorId: string): Promise<Purchase>;
  receivePurchase(scope: MerchantScope, purchaseId: string, actorId: string): Promise<Purchase>;
  cancelPurchase(scope: MerchantScope, purchaseId: string, actorId: string): Promise<Purchase>;
  listFinancialCategories(scope: MerchantScope): Promise<FinancialCategory[]>;
  createFinancialCategory(scope: MerchantScope, input: FinancialCategoryInput): Promise<FinancialCategory>;
  listFinance(scope: MerchantScope, query: FinanceQuery): Promise<Page<FinancialEntry>>;
  createFinancialEntry(scope: MerchantScope, input: FinancialEntryInput, actorId: string): Promise<FinancialEntry>;
  settleFinancialEntry(scope: MerchantScope, entryId: string, settledAt: string): Promise<FinancialEntry>;
  cancelFinancialEntry(scope: MerchantScope, entryId: string): Promise<FinancialEntry>;
  summarizeFinance(scope: MerchantScope, from: string, to: string): Promise<FinanceSummary>;
  listTasks(scope: MerchantScope): Promise<MerchantTask[]>;
  createTask(scope: MerchantScope, input: MerchantTaskInput, actorId: string): Promise<MerchantTask>;
  completeTask(scope: MerchantScope, taskId: string): Promise<MerchantTask>;
}
