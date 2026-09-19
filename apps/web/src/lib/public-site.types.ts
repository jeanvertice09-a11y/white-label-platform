export interface PublicBrand {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export type PublicDomainState = "unknown" | "configuring" | "unavailable";

export type PublicSiteExperience =
  | { kind: "kataluu"; canonicalUrl: string | null }
  | { kind: "white_label"; brand: PublicBrand; canonicalUrl: string | null; loginUrl: string | null }
  | { kind: "state"; state: PublicDomainState };

export interface PublicLoginExperience {
  brand: PublicBrand;
  tenantBranded: boolean;
  available: boolean;
  panelLoginUrl: string | null;
}
