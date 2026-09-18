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

export interface CustomerOrderSummary {
  id: string;
  orderNumber: number;
  totalCents: number;
  status: string;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  orderCount: number;
  totalSpentCents: number;
  lastPurchaseAt: string | null;
  orders: CustomerOrderSummary[];
}
