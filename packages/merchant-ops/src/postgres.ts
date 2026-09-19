import type { MerchantOperationsRepository, MerchantOpsSqlExecutor } from "./repository.ts";
import type {
  FinanceQuery,
  FinancialCategoryInput,
  FinancialEntryInput,
  MerchantScope,
  MerchantTaskInput,
  PageQuery,
  PurchaseInput,
  SupplierInput,
  SupplierStatus,
} from "./types.ts";
import { createSupplier, listSuppliers, updateSupplierStatus } from "./suppliers.ts";
import { cancelPurchase, createPurchase, listPurchases, receivePurchase } from "./purchases.ts";
import {
  cancelFinancialEntry,
  createFinancialCategory,
  createFinancialEntry,
  listFinance,
  listFinancialCategories,
  settleFinancialEntry,
  summarizeFinance,
} from "./finance.ts";
import { completeTask, createTask, listTasks } from "./tasks.ts";

export class PostgresMerchantOperationsRepository implements MerchantOperationsRepository {
  constructor(private readonly sql: MerchantOpsSqlExecutor) {}

  listSuppliers(scope: MerchantScope, query: PageQuery) {
    return listSuppliers(this.sql, scope, query);
  }

  createSupplier(scope: MerchantScope, input: SupplierInput) {
    return createSupplier(this.sql, scope, input);
  }

  updateSupplierStatus(scope: MerchantScope, supplierId: string, status: SupplierStatus) {
    return updateSupplierStatus(this.sql, scope, supplierId, status);
  }

  listPurchases(scope: MerchantScope, query: PageQuery) {
    return listPurchases(this.sql, scope, query);
  }

  createPurchase(scope: MerchantScope, input: PurchaseInput, actorId: string) {
    return createPurchase(this.sql, scope, input, actorId);
  }

  receivePurchase(scope: MerchantScope, purchaseId: string, actorId: string) {
    return receivePurchase(this.sql, scope, purchaseId, actorId);
  }

  cancelPurchase(scope: MerchantScope, purchaseId: string, actorId: string) {
    return cancelPurchase(this.sql, scope, purchaseId, actorId);
  }

  listFinancialCategories(scope: MerchantScope) {
    return listFinancialCategories(this.sql, scope);
  }

  createFinancialCategory(scope: MerchantScope, input: FinancialCategoryInput) {
    return createFinancialCategory(this.sql, scope, input);
  }

  listFinance(scope: MerchantScope, query: FinanceQuery) {
    return listFinance(this.sql, scope, query);
  }

  createFinancialEntry(scope: MerchantScope, input: FinancialEntryInput, actorId: string) {
    return createFinancialEntry(this.sql, scope, input, actorId);
  }

  settleFinancialEntry(scope: MerchantScope, entryId: string, settledAt: string) {
    return settleFinancialEntry(this.sql, scope, entryId, settledAt);
  }

  cancelFinancialEntry(scope: MerchantScope, entryId: string) {
    return cancelFinancialEntry(this.sql, scope, entryId);
  }

  summarizeFinance(scope: MerchantScope, from: string, to: string) {
    return summarizeFinance(this.sql, scope, from, to);
  }

  listTasks(scope: MerchantScope) {
    return listTasks(this.sql, scope);
  }

  createTask(scope: MerchantScope, input: MerchantTaskInput, actorId: string) {
    return createTask(this.sql, scope, input, actorId);
  }

  completeTask(scope: MerchantScope, taskId: string) {
    return completeTask(this.sql, scope, taskId);
  }
}
