// Tipos espelhando supabase/migrations/0001_foundation.sql (fonte: SQL explícito).
export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended" | "trial";
  created_at: string;
}

export interface StoreRow {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  status: "active" | "suspended" | "draft";
}

export interface DomainRow {
  id: string;
  tenant_id: string;
  store_id: string | null;
  hostname: string;
  type: "tenant_panel" | "tenant_site" | "store_admin" | "store_catalog";
  status: "pending" | "active" | "suspended";
  verification_token: string | null;
  verified_at: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  tenant_id: string | null;
  store_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  request_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
