import { createOrderFromCart } from "./postgres-create.ts";
import { getOrderById, listOrders } from "./postgres-read.ts";
import { advanceOrder, cancelOrder, confirmOrder } from "./postgres-status.ts";
import type { OrderRepository, OrderSqlExecutor } from "./repository.ts";

export function createOrderRepository(sql: OrderSqlExecutor): OrderRepository {
  return {
    createFromCart: (scope, input) => createOrderFromCart(sql, scope, input),
    getById: (scope, id) => getOrderById(sql, scope, id),
    list: (scope, limit) => listOrders(sql, scope, limit),
    confirm: (scope, id) => confirmOrder(sql, scope, id),
    cancel: (scope, id) => cancelOrder(sql, scope, id),
    advance: (scope, id, status) => advanceOrder(sql, scope, id, status),
  };
}
