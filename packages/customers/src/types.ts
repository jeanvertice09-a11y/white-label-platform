export interface CustomerScope {
  tenantId: string;
  storeId: string;
}

export interface Customer extends CustomerScope {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  birthDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMutationInput {
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  birthDate: string | null;
  notes: string | null;
}

export interface CustomerListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CustomerListItem extends Customer {
  totalOrders: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}

export interface CustomerPage {
  items: CustomerListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: number;
  totalCents: number;
  status: string;
  paymentStatus: string;
  itemCount: number;
  itemSummary: string | null;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  totalOrders: number;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  lastPurchaseAt: string | null;
  orders: CustomerOrderSummary[];
}
