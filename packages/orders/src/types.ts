export interface OrderScope {
  tenantId: string;
  storeId: string;
}

export type OrderOrigin = "whatsapp" | "online" | "manual" | "pdv";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export interface OrderItem extends OrderScope {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  skuSnapshot: string | null;
  quantity: number;
  unitCents: number;
  totalCents: number;
}

export interface Order extends OrderScope {
  id: string;
  orderNumber: number;
  origin: OrderOrigin;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  couponId: string | null;
  couponCodeSnapshot: string | null;
  notes: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
}

export interface OrderCartItemInput {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface CreateOrderFromCartInput {
  idempotencyKey: string;
  origin: OrderOrigin;
  customerId?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  couponCode?: string | null;
  notes: string | null;
  shippingCents: number;
  items: OrderCartItemInput[];
}

export interface OrderListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrderStatus;
  date?: string;
}

export interface OrderPage {
  items: Order[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OrderTimelineEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
