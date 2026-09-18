import type {
  CreateOrderFromCartInput,
  Order,
  OrderScope,
  OrderStatus,
} from "./types.ts";

export interface OrderSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface OrderRepository {
  createFromCart(scope: OrderScope, input: CreateOrderFromCartInput): Promise<Order>;
  getById(scope: OrderScope, id: string): Promise<Order | null>;
  list(scope: OrderScope, limit: number): Promise<Order[]>;
  confirm(scope: OrderScope, id: string): Promise<Order | null>;
  cancel(scope: OrderScope, id: string): Promise<Order | null>;
  advance(scope: OrderScope, id: string, status: Extract<OrderStatus, "preparing" | "ready" | "completed">): Promise<Order | null>;
}
