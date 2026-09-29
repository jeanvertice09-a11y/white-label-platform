import { describe, expect, test } from "bun:test";
import type { Category } from "@white-label/catalog";
import { parseCsvText, validateImportRows } from "../../apps/web/src/lib/bulk-import.ts";

const scope = { tenantId: "11111111-1111-4111-8111-111111111111", storeId: "22222222-2222-4222-8222-222222222222" };
const categories: Category[] = [
  { ...scope, id: "33333333-3333-4333-8333-333333333333", name: "Roupas", slug: "roupas", description: null, parentId: null, active: true, position: 0 },
  { ...scope, id: "44444444-4444-4444-8444-444444444444", name: "Camisetas", slug: "camisetas", description: null, parentId: "33333333-3333-4333-8333-333333333333", active: true, position: 0 },
];

describe("bulk product CSV", () => {
  test("parses quoted Brazilian prices and preview rows", () => {
    const rows = parseCsvText('nome,sku,preco,estoque,status,controlar_estoque\nCamiseta,CAM-1,"79,90",3,ativo,true\n');
    const result = validateImportRows(rows, categories);
    expect(result.totalValid).toBe(1);
    expect(result.products[0]?.priceCents).toBe(7990);
    expect(result.products[0]?.stockQuantity).toBe(3);
  });

  test("rejects missing mandatory column", () => {
    expect(() => parseCsvText("nome,sku\nCamiseta,CAM-1\n")).toThrow("Coluna obrigatória ausente: preco");
  });

  test("detects invalid price and stock", () => {
    const rows = parseCsvText("nome,preco,estoque\nProduto,abc,-2\n");
    const result = validateImportRows(rows, categories);
    expect(result.totalInvalid).toBe(1);
    expect(result.issues.some((item) => item.field === "preco")).toBe(true);
    expect(result.issues.some((item) => item.field === "estoque")).toBe(true);
  });

  test("detects duplicate SKU in file and existing store conflicts", () => {
    const rows = parseCsvText("nome,sku,preco\nUm,DUP-1,10\nDois,DUP-1,12\nTres,EXISTE,15\n");
    const result = validateImportRows(rows, categories, ["EXISTE"]);
    expect(result.issues.some((item) => item.message.includes("duplicado no arquivo"))).toBe(true);
    expect(result.issues.some((item) => item.message.includes("já existe nesta loja"))).toBe(true);
  });

  test("resolves category/subcategory only from the supplied store scope", () => {
    const rows = parseCsvText("nome,preco,categoria,subcategoria\nCamiseta,79.90,Roupas,Camisetas\n");
    const result = validateImportRows(rows, categories);
    expect(result.totalValid).toBe(1);
    expect(result.products[0]?.categoryId).toBe("44444444-4444-4444-8444-444444444444");
  });

  test("normalizes real variants and their attributes", () => {
    const variants = '[{"name":"Azul M","sku":"VAR-1","attributes":{"Cor":"Azul","Tamanho":"M"},"price":"89,90","stock":4,"status":"ativo"}]';
    const escaped = `"${variants.replaceAll('"', '""')}"`;
    const rows = parseCsvText(`nome,sku,preco,controlar_estoque,variantes_json\nCamiseta,CAM-2,79.90,true,${escaped}\n`);
    const result = validateImportRows(rows, categories);
    expect(result.totalValid).toBe(1);
    expect(result.products[0]?.stockQuantity).toBe(0);
    expect(result.products[0]?.variants[0]?.attributes).toEqual({ Cor: "Azul", Tamanho: "M" });
    expect(result.products[0]?.variants[0]?.stockQuantity).toBe(4);
  });
});
