import type {
  Customer,
  CustomerDetail,
  CustomerListQuery,
  CustomerMutationInput,
  CustomerPage,
  CustomerScope,
} from "./types.ts";

export interface CustomerSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface CustomerRepository {
  list(scope: CustomerScope, search: string, limit: number): Promise<Customer[]>;
  listPage(scope: CustomerScope, query: CustomerListQuery): Promise<CustomerPage>;
  getById(scope: CustomerScope, id: string): Promise<CustomerDetail | null>;
  create(
    scope: CustomerScope,
    input: CustomerMutationInput,
    actorUserId?: string | null,
  ): Promise<Customer>;
  update(
    scope: CustomerScope,
    id: string,
    input: CustomerMutationInput,
    actorUserId?: string | null,
  ): Promise<Customer | null>;
}
