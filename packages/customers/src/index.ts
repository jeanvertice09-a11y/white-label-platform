export type {
  CustomerScope,
  Customer,
  CustomerMutationInput,
  CustomerOrderSummary,
  CustomerDetail,
} from "./types.ts";
export type {
  CustomerSqlExecutor,
  CustomerRepository,
} from "./repository.ts";
export {
  normalizeCustomerPhone,
  assertCustomerScope,
  normalizeCustomerInput,
} from "./validation.ts";
export { createCustomerRepository } from "./postgres.ts";
