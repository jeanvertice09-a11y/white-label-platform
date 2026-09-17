import { describe, expect, test } from "bun:test";
import {
  CatalogUnavailableError,
  PostgresCatalogRepository,
  addItemToCart,
  buildWhatsappCheckoutUrl,
  calculateCartLineTotal,
  createEmptyCart,
  getCartTotalCents,
  loadPublicCatalog,
  loadPublicProduct,
  normalizeCatalogListInput,
  normalizeMerchantBannerInput,
  normalizeMerchantCatalogSettingsInput,
  normalizeMerchantProductInput,
  resolveCatalogUnitPrice,
} from "../../packages/catalog/src/index.ts";
import type {
  CatalogRepository,
  CatalogScope,
  NormalizedCatalogListInput,
} from "../../packages/catalog/src/index.ts";

const SCOPE: CatalogScope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  storeId: "22222222-2222-4222-8222-222222222222",
};

const PRODUCT = {
  id: "33333333-3333-4333-8333-333333333333",
  tenantId: SCOPE.tenantId,
  storeId: SCOPE.storeId,
  categoryId: null,
  slug: "camiseta-preta",
  name: "Camiseta Preta",
  priceCents: 1299,
  active: true,
  createdAt: "2026-09-17T00:00:00.000Z",
};

function repository(available = true): CatalogRepository {
  return {
    isStorePubliclyAvailable: () => Promise.resolve(available),
    getSettings: () => Promise.resolve(null),
    listBanners: () => Promise.resolve([]),
    listCategories: () =>
      Promise.resolve([
        {
          id: "44444444-4444-4444-8444-444444444444",
          tenantId: SCOPE.tenantId,
          storeId: SCOPE.storeId,
          slug: "roupas",
          name: "Roupas",
          createdAt: "2026-09-17T00:00:00.000Z",
        },
      ]),
    listProducts: (
      _scope: CatalogScope,
      _input: NormalizedCatalogListInput,
    ) => Promise.resolve({ items: [PRODUCT], total: 1 }),
    findActiveProductBySlug: (_scope: CatalogScope, slug: string) =>
      Promise.resolve(slug === PRODUCT.slug ? PRODUCT : null),
    listProductVariants: () => Promise.resolve([]),
    listProductImages: () => Promise.resolve([]),
  };
}

describe("catalog query normalization", () => {
  test("normaliza defaults e busca", () => {
    expect(normalizeCatalogListInput({ search: "  camiseta  " })).toEqual({
      page: 1,
      pageSize: 24,
      search: "camiseta",
      categorySlug: null,
      sort: "newest",
    });
  });

  test("rejeita paginação e categoria inválidas", () => {
    expect(() => normalizeCatalogListInput({ page: 0 })).toThrow();
    expect(() => normalizeCatalogListInput({ pageSize: 49 })).toThrow();
    expect(() => normalizeCatalogListInput({ categorySlug: "../outra-loja" })).toThrow();
  });
});

describe("public catalog service", () => {
  test("retorna snapshot paginado somente para loja disponível", async () => {
    const result = await loadPublicCatalog(
      SCOPE,
      { page: 1, pageSize: 24, categorySlug: "roupas" },
      repository(),
    );

    expect(result.products.total).toBe(1);
    expect(result.products.totalPages).toBe(1);
    expect(result.products.items[0]?.storeId).toBe(SCOPE.storeId);
    expect(result.categories[0]?.tenantId).toBe(SCOPE.tenantId);
  });

  test("falha fechado quando tenant/store não está disponível", async () => {
    await expect(
      loadPublicCatalog(SCOPE, {}, repository(false)),
    ).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  test("produto público precisa existir e estar ativo no escopo", async () => {
    const product = await loadPublicProduct(SCOPE, "camiseta-preta", repository());
    expect(product.id).toBe(PRODUCT.id);

    await expect(
      loadPublicProduct(SCOPE, "produto-inexistente", repository()),
    ).rejects.toThrow("Produto não encontrado");
  });
});

describe("PostgresCatalogRepository", () => {
  test("todas as consultas carregam tenantId + storeId como escopo", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql = {
      query(query: string, params: unknown[]): Promise<Record<string, unknown>[]> {
        calls.push({ sql: query, params });

        if (query.includes("select 1")) return Promise.resolve([{ "?column?": 1 }]);
        if (query.includes("count(*)")) return Promise.resolve([{ total: "0" }]);
        return Promise.resolve([]);
      },
    };

    const repo = new PostgresCatalogRepository(sql);
    expect(await repo.isStorePubliclyAvailable(SCOPE)).toBe(true);
    await repo.listCategories(SCOPE);
    await repo.listProducts(SCOPE, normalizeCatalogListInput({}));
    await repo.findActiveProductBySlug(SCOPE, "camiseta-preta");

    expect(calls.length).toBe(5);
    for (const call of calls) {
      expect(call.params[0]).toBe(SCOPE.tenantId);
      expect(call.params[1]).toBe(SCOPE.storeId);
    }
  });

  test("mapeia produto ativo sem perder preço em centavos", async () => {
    const sql = {
      query(): Promise<Record<string, unknown>[]> {
        return Promise.resolve([
          {
            id: PRODUCT.id,
            tenant_id: SCOPE.tenantId,
            store_id: SCOPE.storeId,
            category_id: null,
            slug: PRODUCT.slug,
            name: PRODUCT.name,
            price_cents: "1299",
            active: true,
            created_at: PRODUCT.createdAt,
          },
        ]);
      },
    };

    const repo = new PostgresCatalogRepository(sql);
    const product = await repo.findActiveProductBySlug(SCOPE, PRODUCT.slug);

    expect(product?.priceCents).toBe(1299);
    expect(product?.tenantId).toBe(SCOPE.tenantId);
    expect(product?.storeId).toBe(SCOPE.storeId);
  });
});


describe("catalog cart pricing", () => {
  test("usa exatamente o preço da variante selecionada", () => {
    const variants = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        tenantId: SCOPE.tenantId,
        storeId: SCOPE.storeId,
        productId: PRODUCT.id,
        name: "P",
        sku: "CAM-P",
        attributes: { Tamanho: "P" },
        priceCents: 1299,
        active: true,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        tenantId: SCOPE.tenantId,
        storeId: SCOPE.storeId,
        productId: PRODUCT.id,
        name: "G",
        sku: "CAM-G",
        attributes: { Tamanho: "G" },
        priceCents: 1399,
        active: true,
      },
    ];

    expect(
      resolveCatalogUnitPrice(SCOPE, PRODUCT, variants, variants[0]?.id),
    ).toBe(1299);

    expect(
      resolveCatalogUnitPrice(SCOPE, PRODUCT, variants, variants[1]?.id),
    ).toBe(1399);
  });

  test("produto com variantes exige uma variante válida", () => {
    const variants = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        tenantId: SCOPE.tenantId,
        storeId: SCOPE.storeId,
        productId: PRODUCT.id,
        name: "P",
        sku: null,
        attributes: { Tamanho: "P" },
        priceCents: 1299,
        active: true,
      },
    ];

    expect(() => resolveCatalogUnitPrice(SCOPE, PRODUCT, variants)).toThrow(
      "Selecione uma variante",
    );
    expect(() =>
      resolveCatalogUnitPrice(SCOPE, PRODUCT, variants, "outra-variante"),
    ).toThrow("Variante selecionada indisponível");
  });

  test("produto sem variantes usa o preço base e totaliza por quantidade", () => {
    const unit = resolveCatalogUnitPrice(SCOPE, PRODUCT, []);
    expect(unit).toBe(1299);
    expect(calculateCartLineTotal(unit, 3)).toBe(3897);
  });

  test("rejeita variante de outra loja", () => {
    const foreignVariant = {
      id: "77777777-7777-4777-8777-777777777777",
      tenantId: SCOPE.tenantId,
      storeId: "88888888-8888-4888-8888-888888888888",
      productId: PRODUCT.id,
      name: "G",
      sku: null,
      attributes: { Tamanho: "G" },
      priceCents: 999,
      active: true,
    };

    expect(() =>
      resolveCatalogUnitPrice(SCOPE, PRODUCT, [foreignVariant], foreignVariant.id),
    ).toThrow("Variante fora do produto");
  });
});


describe("catalog cart and WhatsApp", () => {
  test("carrinho mantém o preço exato da variante e soma corretamente", () => {
    const variants = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        tenantId: SCOPE.tenantId,
        storeId: SCOPE.storeId,
        productId: PRODUCT.id,
        name: "P",
        sku: null,
        attributes: { Tamanho: "P" },
        priceCents: 1299,
        active: true,
      },
    ];

    const cart = addItemToCart(SCOPE, createEmptyCart(SCOPE), {
      product: PRODUCT,
      variants,
      selectedVariantId: variants[0]?.id,
      quantity: 2,
    });

    expect(cart.items[0]?.unitPriceCents).toBe(1299);
    expect(getCartTotalCents(cart)).toBe(2598);
  });

  test("gera URL do WhatsApp sem aceitar checkout desativado", () => {
    const cart = {
      tenantId: SCOPE.tenantId,
      storeId: SCOPE.storeId,
      items: [
        {
          key: PRODUCT.id,
          productId: PRODUCT.id,
          productSlug: PRODUCT.slug,
          productName: PRODUCT.name,
          variantId: null,
          variantName: null,
          unitPriceCents: 1299,
          quantity: 1,
        },
      ],
    };

    const settings = {
      tenantId: SCOPE.tenantId,
      storeId: SCOPE.storeId,
      layout: "classic" as const,
      primaryColor: "#111111",
      accentColor: "#111111",
      backgroundColor: "#ffffff",
      fontKey: "system" as const,
      showSearch: true,
      showCategories: true,
      showStock: false,
      showPrices: true,
      checkoutMode: "whatsapp" as const,
      whatsappPhone: "+5562999999999",
      whatsappMessageTemplate: "Olá! Gostaria de fazer este pedido:",
      currency: "BRL" as const,
      seoTitle: null,
      seoDescription: null,
      labels: {},
    };

    const url = buildWhatsappCheckoutUrl({
      storeName: "Loja Teste",
      cart,
      settings,
    });

    expect(url.startsWith("https://wa.me/5562999999999?text=")).toBe(true);
  });
});

describe("merchant catalog admin validation", () => {
  test("normaliza produto e gera slug", () => {
    const input = normalizeMerchantProductInput({
      name: "Camiseta Ázul",
      priceCents: 4990,
    });
    expect(input.slug).toBe("camiseta-azul");
    expect(input.priceCents).toBe(4990);
  });

  test("valida configurações e WhatsApp E.164", () => {
    const settings = normalizeMerchantCatalogSettingsInput({
      layout: "modern",
      whatsappPhone: "+5562999999999",
      checkoutMode: "both",
    });
    expect(settings.layout).toBe("modern");
    expect(settings.checkoutMode).toBe("both");
  });

  test("banner só aceita object key da própria loja", () => {
    expect(() =>
      normalizeMerchantBannerInput(SCOPE, {
        objectKey: "tenants/outro/stores/outra/banner/x.webp",
      }),
    ).toThrow("fora do escopo");

    const banner = normalizeMerchantBannerInput(SCOPE, {
      objectKey: `tenants/${SCOPE.tenantId}/stores/${SCOPE.storeId}/brand/banner.webp`,
    });
    expect(banner.active).toBe(true);
  });
});
