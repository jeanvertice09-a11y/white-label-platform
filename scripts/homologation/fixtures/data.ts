import type { DemoCategory, DemoProduct, DemoStore, DemoTenant, DemoVariant, StoreKey } from "../model.ts";
import { stableUuid, storeIdFor, tenantIdFor } from "../model.ts";

interface StoreBlueprint {
  key: StoreKey;
  tenantKey: "aurora" | "nexo";
  name: string;
  slug: string;
  segment: string;
  description: string;
  layout: "classic" | "modern";
  primaryColor: string;
  accentColor: string;
  whatsapp: string;
  basePrice: number;
  variantCount: number;
  variantValues: readonly string[];
  variantLabel: string;
  categoryPairs: readonly (readonly [string, string])[];
  productNames: readonly string[];
  productCategoryIndexes: readonly number[];
}

export const DEMO_TENANTS: readonly DemoTenant[] = [
  {
    key: "aurora",
    id: tenantIdFor("aurora"),
    name: "Aurora Commerce HML",
    slug: "hml-aurora-commerce",
    companyName: "Aurora Commerce Tecnologia de Varejo Ltda. — Homologação",
    primaryColor: "#7C3AED",
  },
  {
    key: "nexo",
    id: tenantIdFor("nexo"),
    name: "Nexo Varejo HML",
    slug: "hml-nexo-varejo",
    companyName: "Nexo Varejo Digital Ltda. — Homologação",
    primaryColor: "#0F766E",
  },
];

const BLUEPRINTS: readonly StoreBlueprint[] = [
  {
    key: "lume", tenantKey: "aurora", name: "Lume Atelier HML", slug: "hml-lume-atelier",
    segment: "Moda feminina", description: "Moda feminina contemporânea com peças versáteis para rotina e ocasiões especiais.",
    layout: "classic", primaryColor: "#7C2D12", accentColor: "#F59E0B", whatsapp: "5562999001001", basePrice: 8990,
    variantCount: 8, variantValues: ["P", "M", "G"], variantLabel: "Tamanho",
    categoryPairs: [["Vestidos", "Midi e Longos"], ["Alfaiataria", "Calças e Blazers"], ["Essenciais", "Blusas e Camisas"]],
    productNames: [
      "Vestido Midi Canelado", "Camisa Linho Oversized", "Calça Alfaiataria Reta", "Blazer Estruturado Areia",
      "Vestido Envelope Aurora", "Saia Midi Plissada", "Body Canelado Decote V", "Macacão Pantalona Luna",
      "Camisa Tricoline Essencial", "Calça Wide Leg Serena", "Regata Acetinada Íris", "Vestido Chemise Oliva",
      "Saia Jeans Midi Clara", "Blusa Manga Bufante", "Calça Cenoura Grafite", "Colete Alfaiataria Bege",
      "Vestido Curto Texturizado", "Camisa Cropped Natural",
    ],
    productCategoryIndexes: [0, 2, 1, 1, 0, 0, 2, 0, 2, 1, 2, 0, 0, 2, 1, 1, 0, 2],
  },
  {
    key: "botanica", tenantKey: "aurora", name: "Botânica Lab HML", slug: "hml-botanica-lab",
    segment: "Skincare e cosméticos", description: "Cuidados faciais e corporais com rotinas simples, texturas leves e ativos conhecidos.",
    layout: "modern", primaryColor: "#166534", accentColor: "#84CC16", whatsapp: "5562999001002", basePrice: 4590,
    variantCount: 5, variantValues: ["30 ml", "60 ml"], variantLabel: "Volume",
    categoryPairs: [["Rosto", "Tratamentos"], ["Proteção", "Protetores"], ["Corpo", "Hidratação"]],
    productNames: [
      "Sérum Vitamina C 10%", "Hidratante Facial Ceramidas", "Protetor Solar Facial FPS 60", "Gel de Limpeza Suave",
      "Sérum Niacinamida 10%", "Água Micelar Calmante", "Creme Noturno Renovador", "Balm Labial Reparador",
      "Loção Corporal Aveia", "Óleo Corporal Amêndoas", "Esfoliante Corporal Café", "Máscara Facial Argila Verde",
      "Tônico Facial Equilibrante", "Creme para Área dos Olhos", "Sabonete Facial Espuma", "Bruma Facial Hidratante",
      "Protetor Solar Corporal FPS 50", "Manteiga Corporal Karité",
    ],
    productCategoryIndexes: [0, 0, 1, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 1, 2],
  },
  {
    key: "passo", tenantKey: "nexo", name: "Passo Norte HML", slug: "hml-passo-norte",
    segment: "Calçados", description: "Calçados urbanos e casuais com foco em conforto, materiais resistentes e combinações versáteis.",
    layout: "classic", primaryColor: "#1E3A8A", accentColor: "#EA580C", whatsapp: "5562999002001", basePrice: 12990,
    variantCount: 10, variantValues: ["37", "38", "39", "40"], variantLabel: "Numeração",
    categoryPairs: [["Tênis", "Casual"], ["Sapatos", "Social"], ["Sandálias", "Conforto"]],
    productNames: [
      "Tênis Urban Canvas", "Tênis Runner Flex", "Tênis Couro Minimal", "Mocassim Siena Couro",
      "Oxford Clássico Café", "Sapatênis Soho Marinho", "Sandália Comfort Terra", "Tênis Street Branco",
      "Tênis Knit Motion", "Mocassim Drive Preto", "Bota Chelsea Caramelo", "Sapato Derby Preto",
      "Sandália Slide Essential", "Tênis Retro Court", "Bota Desert Areia", "Sapato Loafer Conhaque",
      "Tênis Trek Light", "Chinelo Slide Norte",
    ],
    productCategoryIndexes: [0, 0, 0, 1, 1, 0, 2, 0, 0, 1, 1, 1, 2, 0, 1, 1, 0, 2],
  },
  {
    key: "casa", tenantKey: "nexo", name: "Casa Nativa HML", slug: "hml-casa-nativa",
    segment: "Casa e decoração", description: "Objetos funcionais e decoração de estética natural para salas, quartos, mesa e organização.",
    layout: "modern", primaryColor: "#78350F", accentColor: "#D97706", whatsapp: "5562999002002", basePrice: 3990,
    variantCount: 6, variantValues: ["Natural", "Areia", "Grafite"], variantLabel: "Cor",
    categoryPairs: [["Decoração", "Vasos e Objetos"], ["Mesa", "Servir"], ["Organização", "Cestos e Caixas"]],
    productNames: [
      "Vaso Cerâmica Horizonte", "Almofada Linho Texturizada", "Manta Tricot Serena", "Bandeja Madeira Nativa",
      "Cesto Fibra Tramado", "Luminária Mesa Íris", "Jogo 4 Copos Âmbar", "Porta-Velas Pedra Clara",
      "Cachepot Cerâmica Fosca", "Jarra Vidro Canelado", "Kit 2 Cestos Organizadores", "Centro de Mesa Orgânico",
      "Porta-Retrato Carvalho", "Difusor Ambiente Cedro", "Bowl Cerâmica Artesanal", "Organizador Bambu Modular",
      "Manta Sofá Algodão", "Vaso Mini Terracota",
    ],
    productCategoryIndexes: [0, 0, 0, 1, 2, 0, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2, 0, 0],
  },
];

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoriesFor(blueprint: StoreBlueprint): DemoCategory[] {
  const result: DemoCategory[] = [];
  blueprint.categoryPairs.forEach(([parent, child], index) => {
    const parentKey = `${blueprint.key}:category:${index}:parent`;
    result.push({ key: parentKey, id: stableUuid(parentKey), name: parent, slug: slugify(parent), parentKey: null, position: index * 2 });
    const childKey = `${blueprint.key}:category:${index}:child`;
    result.push({ key: childKey, id: stableUuid(childKey), name: child, slug: slugify(child), parentKey, position: index * 2 + 1 });
  });
  return result;
}

function variantStock(productIndex: number, variantIndex: number): number {
  if (productIndex === 7 && variantIndex === 2) return 0;
  return 8 + ((productIndex + variantIndex * 3) % 18);
}

function variantsFor(blueprint: StoreBlueprint, productIndex: number, basePrice: number, sku: string): DemoVariant[] {
  if (productIndex >= blueprint.variantCount) return [];
  return blueprint.variantValues.map((value, variantIndex) => ({
    id: stableUuid(`${blueprint.key}:product:${productIndex}:variant:${variantIndex}`),
    name: `${blueprint.variantLabel} ${value}`,
    sku: `${sku}-${String(variantIndex + 1).padStart(2, "0")}`,
    attributes: { [blueprint.variantLabel]: value },
    priceCents: basePrice + variantIndex * 300,
    compareAtPriceCents: productIndex % 4 === 0 ? basePrice + variantIndex * 300 + 2000 : null,
    costCents: Math.round((basePrice + variantIndex * 300) * 0.48),
    initialStock: variantStock(productIndex, variantIndex),
  }));
}

function productsFor(blueprint: StoreBlueprint): DemoProduct[] {
  return blueprint.productNames.map((name, index) => {
    const priceCents = blueprint.basePrice + index * 770;
    const sku = `HML-${blueprint.key.toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
    const categoryPair = blueprint.productCategoryIndexes[index];
    if (categoryPair === undefined || !blueprint.categoryPairs[categoryPair]) {
      throw new Error(`categoria semântica ausente para ${blueprint.key}/${name}`);
    }
    const categoryKey = `${blueprint.key}:category:${categoryPair}:child`;
    return {
      id: stableUuid(`${blueprint.key}:product:${index}`), name, slug: slugify(name), sku,
      description: `${name} da coleção de homologação ${blueprint.name}, com ficha comercial completa para testar catálogo, carrinho, estoque e pedidos.`,
      categoryKey, priceCents, compareAtPriceCents: index % 5 === 0 ? priceCents + 2500 : null,
      costCents: Math.round(priceCents * 0.48),
      initialStock: index === 17 ? 0 : index === 16 ? 2 : index === 0 ? 48 : 12 + (index % 18),
      variants: variantsFor(blueprint, index, priceCents, sku),
    };
  });
}

export const DEMO_STORES: readonly DemoStore[] = BLUEPRINTS.map((blueprint) => ({
  key: blueprint.key,
  tenantKey: blueprint.tenantKey,
  id: storeIdFor(blueprint.key),
  name: blueprint.name,
  slug: blueprint.slug,
  segment: blueprint.segment,
  description: blueprint.description,
  layout: blueprint.layout,
  primaryColor: blueprint.primaryColor,
  accentColor: blueprint.accentColor,
  whatsapp: blueprint.whatsapp,
  categories: categoriesFor(blueprint),
  products: productsFor(blueprint),
}));

export const DEMO_COUNTS = {
  tenants: DEMO_TENANTS.length,
  stores: DEMO_STORES.length,
  categories: DEMO_STORES.reduce((total, store) => total + store.categories.length, 0),
  products: DEMO_STORES.reduce((total, store) => total + store.products.length, 0),
  variants: DEMO_STORES.reduce((total, store) => total + store.products.reduce((sum, product) => sum + product.variants.length, 0), 0),
  customers: DEMO_STORES.length * 12,
  orders: DEMO_STORES.length * 16,
  suppliers: DEMO_STORES.length * 3,
  purchases: DEMO_STORES.length * 4,
  financeEntries: DEMO_STORES.length * 10,
  tasks: DEMO_STORES.length * 6,
  coupons: DEMO_STORES.length * 3,
  campaigns: DEMO_STORES.length,
  productImages: DEMO_STORES.reduce((total, store) => total + store.products.length, 0),
  banners: DEMO_STORES.length,
  tenantLogos: DEMO_TENANTS.length,
  domains: DEMO_TENANTS.length * 2 + DEMO_STORES.length * 2,
  platformSubscriptions: DEMO_TENANTS.length,
  storeSubscriptions: DEMO_STORES.length,
  invoices: DEMO_TENANTS.length * 3 + DEMO_STORES.length * 2,
  payments: 29,
} as const;
