import type {
  Customer,
  CustomerDetail,
  CustomerMutationInput,
  CustomerScope,
} from "./types.ts";

export interface CustomerSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface CustomerRepository {
  list(scope: CustomerScope, search: string, limit: number): Promise<Customer[]>;
  getById(scope: CustomerScope, id: string): Promise<CustomerDetail | null>;
  create(scope: CustomerScope, input: CustomerMutationInput): Promise<Customer>;
  update(scope: CustomerScope, id: string, input: CustomerMutationInput): Promise<Customer | null>;
}
