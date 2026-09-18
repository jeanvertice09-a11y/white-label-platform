import { createOrderFromCart } from "./postgres-create.ts";
import {
  getOrderById,
  getOrderTimeline,
  listOrders,
  listOrdersPage,
} from "./postgres-read.ts";
import { advanceOrder, cancelOrder, confirmOrder } from "./postgres-status.ts";
import type { OrderRepository, OrderSqlExecutor } from "./repository.ts";

export function createOrderRepository(sql: OrderSqlExecutor): OrderRepository {
  return {
    createFromCart: (scope, input) => createOrderFromCart(sql, scope, input),
    getById: (scope, id) => getOrderById(sql, scope, id),
    getTimeline: (scope, id) => getOrderTimeline(sql, scope, id),
    list: (scope, limit) => listOrders(sql, scope, limit),
    listPage: (scope, query) => listOrdersPage(sql, scope, query),
    confirm: (scope, id, actorUserId) => confirmOrder(sql, scope, id, actorUserId),
    cancel: (scope, id, actorUserId) => cancelOrder(sql, scope, id, actorUserId),
    advance: (scope, id, status, actorUserId) => (
      advanceOrder(sql, scope, id, status, actorUserId)
    ),
  };
}
