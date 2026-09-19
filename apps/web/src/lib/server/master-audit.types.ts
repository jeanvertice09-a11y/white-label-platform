export interface MasterAuditFilters {
  action: string;
  actor: string;
  tenant: string;
  store: string;
  resource: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export interface MasterAuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  storeId: string | null;
  storeName: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface MasterAuditResult {
  items: MasterAuditRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
