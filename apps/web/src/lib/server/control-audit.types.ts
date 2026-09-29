export interface ControlAuditFilters {
  action: string;
  actor: string;
  store: string;
  resource: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export interface ControlAuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  storeId: string | null;
  storeName: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface ControlAuditResult {
  items: ControlAuditRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
