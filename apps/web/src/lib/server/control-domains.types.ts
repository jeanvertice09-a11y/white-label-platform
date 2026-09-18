import type { DomainDnsPlan, DomainStatus, DomainType } from "@white-label/domains";

export interface ControlDomainItem {
  id: string;
  tenantId: string;
  storeId: string | null;
  storeName: string | null;
  hostname: string;
  type: DomainType;
  status: DomainStatus;
  verifiedAt: string | null;
  createdAt: string;
  dns: DomainDnsPlan | null;
}

export interface ControlDomainStoreOption {
  id: string;
  name: string;
  status: string;
}

export interface ControlDomainWorkspace {
  canManage: boolean;
  providerName: string;
  providerConfigured: boolean;
  configurationMessage: string;
  domains: ControlDomainItem[];
  stores: ControlDomainStoreOption[];
}

export interface ControlDomainInput {
  hostname: string;
  type: DomainType;
  storeId: string | null;
}

export interface ControlDomainUpdateInput extends ControlDomainInput {
  domainId: string;
}
