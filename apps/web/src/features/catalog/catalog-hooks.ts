import { useState } from "react";
import {
  addItemToCart,
  createEmptyCart,
} from "@white-label/catalog";
import type {
  CatalogCart,
  CatalogListInput,
  Product,
} from "@white-label/catalog";
import {
  getPublicCatalogData,
  getPublicProductData,
} from "../../lib/server/catalog.functions.ts";
import type {
  ProductPayload,
  PublicCatalogPayload,
} from "./view-model.ts";

export function useCatalogListing(initial: PublicCatalogPayload) {
  const [payload, setPayload] = useState(initial);
  const [query, setQuery] = useState<CatalogListInput>({
    page: 1,
    pageSize: 24,
    sort: "newest",
  });
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  async function reload(next: CatalogListInput): Promise<void> {
    setLoading(true);
    try {
      const data = await getPublicCatalogData({
        data: {
          page: next.page ?? 1,
          pageSize: next.pageSize ?? 24,
          search: next.search,
          categorySlug: next.categorySlug,
          sort: next.sort ?? "newest",
        },
      });
      setPayload(data);
      setQuery(next);
    } finally {
      setLoading(false);
    }
  }

  return {
    payload,
    query,
    searchText,
    setSearchText,
    loading,
    reload,
  };
}

export function useProductSelection() {
  const [selected, setSelected] = useState<ProductPayload | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openProduct(product: Product): Promise<void> {
    setDetailLoading(true);
    setSelectedVariantId(null);
    try {
      const detail = await getPublicProductData({
        data: { slug: product.slug },
      });
      setSelected(detail);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeProduct(): void {
    setSelected(null);
    setSelectedVariantId(null);
  }

  return {
    selected,
    setSelected,
    selectedVariantId,
    setSelectedVariantId,
    detailLoading,
    openProduct,
    closeProduct,
  };
}

export function initialCatalogCart(payload: PublicCatalogPayload): CatalogCart {
  if (payload.catalog.products.items.length === 0) {
    return { tenantId: "", storeId: "", items: [] };
  }
  const product = payload.catalog.products.items[0];
  return createEmptyCart({
    tenantId: product.tenantId,
    storeId: product.storeId,
  });
}

export function addProductPayloadToCart(
  cart: CatalogCart,
  selected: ProductPayload,
  selectedVariantId: string | null,
): CatalogCart {
  const product = selected.detail.product;
  const scope = { tenantId: product.tenantId, storeId: product.storeId };
  const base = cart.tenantId && cart.storeId ? cart : createEmptyCart(scope);

  return addItemToCart(scope, base, {
    product,
    variants: selected.detail.variants,
    selectedVariantId,
    quantity: 1,
  });
}
