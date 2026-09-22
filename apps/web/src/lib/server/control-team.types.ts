import type { StoreRole, TenantRole } from "@white-label/auth";

export interface ControlTeamTenantMember {
  userId: string;
  email: string | null;
  role: TenantRole;
  createdAt: string;
}

export interface ControlTeamStoreMember {
  userId: string;
  email: string | null;
  storeId: string;
  storeName: string;
  role: StoreRole;
  createdAt: string;
}

export interface ControlTeamStoreOption {
  id: string;
  name: string;
}

export interface ControlTeamWorkspace {
  canManage: boolean;
  canManageOwners: boolean;
  tenantMembers: ControlTeamTenantMember[];
  storeMembers: ControlTeamStoreMember[];
  stores: ControlTeamStoreOption[];
}
