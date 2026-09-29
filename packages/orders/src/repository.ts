import type {
  CreateOrderFromCartInput,
  Order,
  OrderListQuery,
  OrderPage,
  OrderScope,
  OrderStatus,
  OrderTimelineEntry,
} from "./types.ts";

export interface OrderSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface OrderRepository {
  createFromCart(scope: OrderScope, input: CreateOrderFromCartInput): Promise<Order>;
  getById(scope: OrderScope, id: string): Promise<Order | null>;
  getTimeline(scope: OrderScope, id: string): Promise<OrderTimelineEntry[]>;
  list(scope: OrderScope, limit: number): Promise<Order[]>;
  listPage(scope: OrderScope, query: OrderListQuery): Promise<OrderPage>;
  confirm(scope: OrderScope, id: string, actorUserId?: string | null): Promise<Order | null>;
  cancel(scope: OrderScope, id: string, actorUserId?: string | null): Promise<Order | null>;
  advance(
    scope: OrderScope,
    id: string,
    status: Extract<OrderStatus, "preparing" | "ready" | "completed">,
    actorUserId?: string | null,
  ): Promise<Order | null>;
}
