import type {
  CatalogProductDetail,
  CatalogSettings,
  PublicStorefrontSnapshot,
} from "@white-label/catalog";

export interface PublicCatalogPayload {
  store: { name: string; slug: string };
  catalog: PublicStorefrontSnapshot;
  mediaBaseUrl: string | null;
}

export interface ProductPayload {
  store: { name: string; slug: string };
  detail: CatalogProductDetail;
  settings: CatalogSettings | null;
  mediaBaseUrl: string | null;
}

export function formatCatalogMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
