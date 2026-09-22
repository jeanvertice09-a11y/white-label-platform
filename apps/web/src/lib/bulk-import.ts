import type { Category } from "@white-label/catalog";

export const MAX_IMPORT_BYTES = 2_000_000;
export const MAX_IMPORT_ROWS = 500;
export const MAX_VARIANTS_PER_PRODUCT = 50;

export const IMPORT_COLUMNS = [
  "nome", "slug", "sku", "descricao", "preco", "preco_comparativo", "custo",
  "categoria", "subcategoria", "estoque", "status", "controlar_estoque", "posicao", "variantes_json",
] as const;

export interface RawImportRow {
  line: number;
  values: Partial<Record<string, string>>;
}

export interface ImportIssue {
  line: number | null;
  field: string;
  message: string;
}

export interface NormalizedImportVariant {
  name: string;
  sku: string | null;
  attributes: Record<string, string>;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  stockQuantity: number;
  position: number;
}

export interface NormalizedImportProduct {
  line: number;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  position: number;
  variants: NormalizedImportVariant[];
}

export interface ImportValidationResult {
  products: NormalizedImportProduct[];
  issues: ImportIssue[];
  totalRows: number;
  totalValid: number;
  totalInvalid: number;
}

export const IMPORT_TEMPLATE = `${IMPORT_COLUMNS.join(",")}\nCamiseta Básica,camiseta-basica,CAM-001,Camiseta 100% algodão,"79,90","99,90","40,00",Roupas,Camisetas,12,ativo,true,0,"[{""name"":""Azul / M"",""sku"":""CAM-001-AZ-M"",""attributes"":{""Cor"":""Azul"",""Tamanho"":""M""},""price"":""79,90"",""stock"":5,""status"":""ativo"",""position"":0}]"\n`;

function field(raw: RawImportRow, key: string): string {
  return raw.values[key]?.trim() ?? "";
}

function detectDelimiter(text: string): "," | ";" {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { index += 1; continue; }
      quoted = !quoted;
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) break;
    if (!quoted && char === ",") commas += 1;
    if (!quoted && char === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

function parseCsvRecords(text: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) { row.push(cell); cell = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (quoted) throw new Error("CSV inválido: aspas não foram fechadas");
  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

function canonicalHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

export function parseCsvText(text: string): RawImportRow[] {
  if (!text.trim()) throw new Error("Arquivo CSV vazio");
  const records = parseCsvRecords(text, detectDelimiter(text));
  if (records.length < 2) throw new Error("CSV sem linhas de produtos");
  const headers = records[0].map(canonicalHeader);
  for (const required of ["nome", "preco"]) {
    if (!headers.includes(required)) throw new Error(`Coluna obrigatória ausente: ${required}`);
  }
  const unknown = headers.filter((header) => header && !IMPORT_COLUMNS.includes(header as (typeof IMPORT_COLUMNS)[number]));
  if (unknown.length) throw new Error(`Coluna não suportada: ${unknown[0]}`);
  if (records.length - 1 > MAX_IMPORT_ROWS) throw new Error(`Arquivo excede ${String(MAX_IMPORT_ROWS)} linhas por importação`);
  return records.slice(1).map((record, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, column) => { if (header) values[header] = record[column] ?? ""; });
    return { line: index + 2, values };
  });
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

function scalarText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function cents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  const scalar = scalarText(value);
  if (scalar === null) return null;
  let text = scalar.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function integer(value: unknown, fallback = 0): number | null {
  if (value === null || value === undefined || value === "") return fallback;
  const scalar = scalarText(value);
  if (scalar === null) return null;
  const parsed = Number(scalar.trim());
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 1_000_000 ? parsed : null;
}

function booleanValue(value: unknown, fallback: boolean): boolean | null {
  if (value === null || value === undefined || value === "") return fallback;
  const scalar = scalarText(value);
  if (scalar === null) return null;
  const normalized = scalar.trim().toLowerCase();
  if (["1", "true", "sim", "ativo", "active"].includes(normalized)) return true;
  if (["0", "false", "nao", "não", "inativo", "inactive"].includes(normalized)) return false;
  return null;
}

function issue(issues: ImportIssue[], line: number, key: string, message: string): void {
  issues.push({ line, field: key, message });
}

function optionalMoney(raw: string, line: number, key: string, issues: ImportIssue[]): number | null {
  if (!raw) return null;
  const value = cents(raw);
  if (value === null) issue(issues, line, key, `${key} inválido`);
  return value;
}

function resolveCategory(raw: RawImportRow, categories: Category[], issues: ImportIssue[]): { id: string | null; label: string | null } {
  const categoryName = field(raw, "categoria");
  const subcategoryName = field(raw, "subcategoria");
  if (!categoryName && !subcategoryName) return { id: null, label: null };
  if (!categoryName && subcategoryName) {
    issue(issues, raw.line, "subcategoria", "Subcategoria exige categoria pai");
    return { id: null, label: null };
  }
  const roots = categories.filter((category) => !category.parentId && category.name.localeCompare(categoryName, "pt-BR", { sensitivity: "accent" }) === 0);
  if (roots.length !== 1) {
    issue(issues, raw.line, "categoria", roots.length ? "Categoria ambígua" : "Categoria não encontrada nesta loja");
    return { id: null, label: null };
  }
  const root = roots[0];
  if (!subcategoryName) return { id: root.id, label: root.name };
  const children = categories.filter((category) => category.parentId === root.id && category.name.localeCompare(subcategoryName, "pt-BR", { sensitivity: "accent" }) === 0);
  if (children.length !== 1) {
    issue(issues, raw.line, "subcategoria", children.length ? "Subcategoria ambígua" : "Subcategoria não encontrada nesta categoria");
    return { id: null, label: null };
  }
  return { id: children[0].id, label: `${root.name} / ${children[0].name}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVariantAttributes(value: unknown, line: number, index: number, issues: ImportIssue[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (!isRecord(value)) {
    issue(issues, line, "variantes_json", `Atributos da variante ${String(index + 1)} inválidos`);
    return attributes;
  }
  for (const [keyRaw, valRaw] of Object.entries(value)) {
    const key = keyRaw.trim();
    const val = scalarText(valRaw)?.trim() ?? "";
    if (!key || key.length > 80 || !val || val.length > 120) issue(issues, line, "variantes_json", `Atributo da variante ${String(index + 1)} inválido`);
    else attributes[key] = val;
  }
  return attributes;
}

function normalizeVariant(value: unknown, index: number, raw: RawImportRow, issues: ImportIssue[]): NormalizedImportVariant | null {
  if (!isRecord(value)) {
    issue(issues, raw.line, "variantes_json", `Variante ${String(index + 1)} inválida`);
    return null;
  }
  const name = scalarText(value["name"])?.trim() ?? "";
  const sku = scalarText(value["sku"])?.trim() || null;
  const priceCents = cents(value["price"]);
  const stock = integer(value["stock"], 0);
  const position = integer(value["position"], index);
  const active = booleanValue(value["status"], true);
  const compare = value["compare_at_price"] === undefined ? null : cents(value["compare_at_price"]);
  const cost = value["cost"] === undefined ? null : cents(value["cost"]);
  if (!name || name.length > 160) issue(issues, raw.line, "variantes_json", `Nome da variante ${String(index + 1)} inválido`);
  if (sku && sku.length > 180) issue(issues, raw.line, "variantes_json", `SKU da variante ${String(index + 1)} excede 180 caracteres`);
  if (priceCents === null) issue(issues, raw.line, "variantes_json", `Preço da variante ${String(index + 1)} inválido`);
  if (stock === null) issue(issues, raw.line, "variantes_json", `Estoque da variante ${String(index + 1)} inválido`);
  if (position === null) issue(issues, raw.line, "variantes_json", `Posição da variante ${String(index + 1)} inválida`);
  if (active === null) issue(issues, raw.line, "variantes_json", `Status da variante ${String(index + 1)} inválido`);
  if (value["compare_at_price"] !== undefined && compare === null) issue(issues, raw.line, "variantes_json", `Preço comparativo da variante ${String(index + 1)} inválido`);
  if (value["cost"] !== undefined && cost === null) issue(issues, raw.line, "variantes_json", `Custo da variante ${String(index + 1)} inválido`);
  const attributes = parseVariantAttributes(value["attributes"] ?? {}, raw.line, index, issues);
  if (!name || priceCents === null || stock === null || position === null || active === null) return null;
  return { name, sku, attributes, priceCents, compareAtPriceCents: compare, costCents: cost, active, stockQuantity: stock, position };
}

function parseVariants(raw: RawImportRow, issues: ImportIssue[]): NormalizedImportVariant[] {
  const source = field(raw, "variantes_json");
  if (!source) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { issue(issues, raw.line, "variantes_json", "JSON de variantes inválido"); return []; }
  if (!Array.isArray(parsed) || parsed.length > MAX_VARIANTS_PER_PRODUCT) {
    issue(issues, raw.line, "variantes_json", `Use uma lista JSON com no máximo ${String(MAX_VARIANTS_PER_PRODUCT)} variantes`);
    return [];
  }
  return parsed.flatMap((value, index) => {
    const variant = normalizeVariant(value, index, raw, issues);
    return variant ? [variant] : [];
  });
}

export function validateImportRows(rows: RawImportRow[], categories: Category[], existingSkus: readonly string[] = [], existingSlugs: readonly string[] = []): ImportValidationResult {
  const issues: ImportIssue[] = [];
  const products: NormalizedImportProduct[] = [];
  const seenSkus = new Set<string>();
  const seenSlugs = new Set<string>();
  const existingSkuSet = new Set(existingSkus.filter(Boolean));
  const existingSlugSet = new Set(existingSlugs.filter(Boolean));
  for (const raw of rows) {
    const before = issues.length;
    const name = field(raw, "nome");
    const slug = (field(raw, "slug") || slugify(name)).slice(0, 180);
    const sku = field(raw, "sku") || null;
    const priceCents = cents(field(raw, "preco"));
    const compareAtPriceCents = optionalMoney(field(raw, "preco_comparativo"), raw.line, "preco_comparativo", issues);
    const costCents = optionalMoney(field(raw, "custo"), raw.line, "custo", issues);
    const stock = integer(field(raw, "estoque"), 0);
    const position = integer(field(raw, "posicao"), 0);
    const active = booleanValue(field(raw, "status"), true);
    const trackInventory = booleanValue(field(raw, "controlar_estoque"), false);
    if (!name || name.length > 160) issue(issues, raw.line, "nome", "Nome obrigatório com até 160 caracteres");
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) issue(issues, raw.line, "slug", "Slug inválido");
    if (priceCents === null) issue(issues, raw.line, "preco", "Preço inválido");
    if (stock === null) issue(issues, raw.line, "estoque", "Estoque inválido");
    if (position === null) issue(issues, raw.line, "posicao", "Posição inválida");
    if (active === null) issue(issues, raw.line, "status", "Status inválido; use ativo ou inativo");
    if (trackInventory === null) issue(issues, raw.line, "controlar_estoque", "Controle de estoque inválido; use true ou false");
    if (sku && sku.length > 180) issue(issues, raw.line, "sku", "SKU excede 180 caracteres");
    if (sku && (seenSkus.has(sku) || existingSkuSet.has(sku))) issue(issues, raw.line, "sku", seenSkus.has(sku) ? "SKU duplicado no arquivo" : "SKU já existe nesta loja");
    if (seenSlugs.has(slug) || existingSlugSet.has(slug)) issue(issues, raw.line, "slug", seenSlugs.has(slug) ? "Slug duplicado no arquivo" : "Slug já existe nesta loja");
    const category = resolveCategory(raw, categories, issues);
    const variants = parseVariants(raw, issues);
    for (const variant of variants) {
      if (!variant.sku) continue;
      if (seenSkus.has(variant.sku) || existingSkuSet.has(variant.sku)) issue(issues, raw.line, "variantes_json", seenSkus.has(variant.sku) ? `SKU de variante duplicado no arquivo: ${variant.sku}` : `SKU de variante já existe nesta loja: ${variant.sku}`);
      seenSkus.add(variant.sku);
    }
    if (sku) seenSkus.add(sku);
    seenSlugs.add(slug);
    if (issues.length !== before || priceCents === null || stock === null || position === null || active === null || trackInventory === null) continue;
    products.push({
      line: raw.line, name, slug, description: field(raw, "descricao") || null, sku,
      categoryId: category.id, categoryLabel: category.label, priceCents, compareAtPriceCents, costCents,
      active, trackInventory, stockQuantity: trackInventory && variants.length === 0 ? stock : 0,
      position, variants: variants.map((variant) => ({ ...variant, stockQuantity: trackInventory ? variant.stockQuantity : 0 })),
    });
  }
  const invalidLines = new Set(issues.flatMap((item) => item.line === null ? [] : [item.line]));
  return { products, issues, totalRows: rows.length, totalValid: products.length, totalInvalid: invalidLines.size };
}
