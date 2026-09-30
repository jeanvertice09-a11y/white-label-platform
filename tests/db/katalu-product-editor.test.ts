import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { applyProductListAction } from "../../apps/web/src/lib/server/product-list.server.ts";
import { createCatalogReadRepository } from "../../packages/catalog/src/postgres-read.ts";
import { saveProductEditor } from "../../apps/web/src/lib/server/product-editor.server.ts";
import { productEditorSchema } from "../../apps/web/src/lib/server/product-editor.schema.ts";
import type { ProductEditorInput } from "../../apps/web/src/lib/server/product-editor.schema.ts";
import { createInventoryRepository } from "../../packages/inventory/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";
const ids = seedIds(), scope = {tenantId:ids.tenantA,storeId:ids.storeA};
let h: Harness;
beforeAll(async () => { h = await setupDatabase(); await h.db.execScript(seedSql()); });
afterAll(async () => { await h.db.close(); });
function draft(): ProductEditorInput {
  return productEditorSchema.parse({ input: { name:"Tênis",slug:`tenis-${crypto.randomUUID()}`,description:"Descrição",sku:`TENIS-${crypto.randomUUID()}`,
    barcode:"7891234567890",featured:true,categoryId:null,categoryIds:[],priceCents:9000,compareAtPriceCents:10000,costCents:4500,
    discountType:null,discountValue:null,pixDiscountPercent:5.25,freeShipping:false,active:true,trackInventory:true,stockQuantity:12,position:0 },variants:[] });
}
async function save(data:ProductEditorInput) {
  await h.db.execOne("begin");
  try { const product = await saveProductEditor(h.db,scope,data,ids.users.storeA); await h.db.execOne("commit"); return product; }
  catch (error) { await h.db.execOne("rollback"); throw error; }
}
async function rejectionMessage(work: Promise<unknown>): Promise<string> {
  try { await work; } catch (error) { return error instanceof Error ? error.message : String(error); }
  throw new Error("Esperava rejeição");
}
describe("Katálu product editor with real PostgreSQL", () => {
  test("creates simple stock, prices, barcode and highlight together", async () => {
    const product = await save(draft());
    expect(product?.stockQuantity).toBe(12);
    expect(product?.barcode).toBe("7891234567890");
    expect(product?.featured).toBe(true);
    expect(product?.pixDiscountPercent).toBe(5.25);
    expect(product?.priceCents).toBe(9000);
    const rows = await h.db.query("select sum(delta)::integer quantity from public.stock_movements where product_id=$1",[product?.id]);
    expect(Number(rows[0]?.["quantity"])).toBe(12);
  });
  test("editing product updates stock through the ledger", async () => {
    const input = draft(), product = await save(input);
    input.id = product?.id; input.expectedStockQuantity = 12; input.input.stockQuantity = 7;
    const updated = await save(input);
    expect(updated?.stockQuantity).toBe(7);
    const rows = await h.db.query("select sum(delta)::integer quantity from public.stock_movements where product_id=$1",[input.id]);
    expect(Number(rows[0]?.["quantity"])).toBe(7);
  });
  test("creates and edits each option with its own stock", async () => {
    const input = draft(); input.input.stockQuantity = 0;
    input.variants = ["P","M"].map((name,index) => ({name,sku:null,attributes:{Tamanho:name},priceCents:9000,
      compareAtPriceCents:null,costCents:4000,stockQuantity:index+3,active:true,position:index}));
    const product = await save(input);
    expect(product?.variants.map(v => v.stockQuantity)).toEqual([3,4]);
    input.id = product?.id;
    input.variants = product?.variants.map(v => ({...v,expectedStockQuantity:v.stockQuantity,stockQuantity:v.stockQuantity+2})) ?? [];
    const updated = await save(input);
    expect(updated?.variants.map(v => v.stockQuantity)).toEqual([5,6]);
  });
  test("metadata edits do not undo a sale made after opening the product", async () => {
    const input = draft(), product = await save(input);
    if (!product) throw new Error("Produto não criado");
    await createInventoryRepository(h.db).move(scope,{operationId:crypto.randomUUID(),productId:product.id,variantId:null,
      kind:"exit",quantity:2,reason:"Venda durante edição",createdBy:ids.users.storeA});
    input.id=product.id; input.expectedStockQuantity=12; input.input.name="Tênis novo nome";
    expect((await save(input))?.stockQuantity).toBe(10);
    input.input.stockQuantity=15;
    expect(await rejectionMessage(save(input))).toContain("estoque mudou");
    const rows=await h.db.query("select stock_quantity from public.products where id=$1",[product.id]);
    expect(Number(rows[0]?.["stock_quantity"])).toBe(10);
  });
  test("duplicate options roll the entire creation back", async () => {
    const input=draft(); const v={name:"P",sku:null,attributes:{Tamanho:"P"},priceCents:1000,compareAtPriceCents:null,
      costCents:null,active:true,stockQuantity:3,position:0}; input.variants=[v,{...v,position:1}];
    expect(await rejectionMessage(save(input))).toContain("já cadastrada");
    const rows=await h.db.query("select id from public.products where slug=$1",[input.input.slug]);
    expect(rows).toHaveLength(0);
  });
  test("a foreign product or option cannot be changed", async () => {
    const product=await save(draft());
    const input=draft(); input.id=product?.id;
    expect(await rejectionMessage(saveProductEditor(h.db,{tenantId:ids.tenantB,storeId:ids.storeB},input,ids.users.storeB))).toContain("não encontrado");
    const own=draft(); own.variants=[{id:crypto.randomUUID(),name:"P",sku:null,attributes:{Tamanho:"P"},priceCents:1000,
      compareAtPriceCents:null,costCents:null,active:true,stockQuantity:3,position:0}];
    expect(await rejectionMessage(save(own))).toContain("Variação não encontrada");
  });
  test("invalid photo aborts creation instead of publishing a partial product", async () => {
    const input=draft(); input.photos=[{assetId:crypto.randomUUID(),position:0}];
    expect(await rejectionMessage(save(input))).toContain("não encontrado");
    expect(await h.db.query("select id from public.products where slug=$1",[input.input.slug])).toHaveLength(0);
  });
  test("deleting a product removes it from both catalogs while retaining sales stock history", async () => {
    const product=await save(draft()); if(!product)throw new Error("Produto não criado");
    await applyProductListAction(h.db,scope,{ids:[product.id],action:"delete"},ids.users.storeA);
    const reader=createCatalogReadRepository(h.db);
    expect(await reader.getProductById(scope,product.id)).toBeNull();
    expect(await reader.getProductBySlug(scope,product.slug,true)).toBeNull();
    const rows=await h.db.query("select sum(delta)::integer quantity from public.stock_movements where product_id=$1",[product.id]);
    expect(Number(rows[0]?.["quantity"])).toBe(12);
  });
  test("bulk actions fail before any update if one product is outside the store", async () => {
    const product=await save(draft()); if(!product)throw new Error("Produto não criado");
    expect(await rejectionMessage(applyProductListAction(h.db,scope,{ids:[product.id,crypto.randomUUID()],action:"hide"},ids.users.storeA))).toContain("não pertence");
    const rows=await h.db.query("select active from public.products where id=$1",[product.id]);
    expect(rows[0]?.["active"]).toBe(true);
  });

  test("ready photos and cover order are saved with the product", async () => {
    const input=draft(),assetId=crypto.randomUUID(),objectKey=`tenants/${scope.tenantId}/stores/${scope.storeId}/product/${assetId}.png`;
    await h.db.query(`insert into public.media_assets(id,tenant_id,store_id,object_key,content_type,size_bytes,public_url,kind,status,upload_expires_at)
      values($1,$2,$3,$4,'image/png',100,$5,'product','ready',now()+interval '10 minutes')`,[assetId,scope.tenantId,scope.storeId,objectKey,`https://cdn.example.test/${assetId}.png`]);
    input.photos=[{assetId,position:0}];
    const product=await save(input);
    expect(product?.images).toHaveLength(1);
    expect(product?.images[0]?.objectKey).toBe(objectKey);
    expect(product?.images[0]?.position).toBe(0);
  });

  test("large variant sets save stock for all combinations", async () => {
    const input=draft();input.input.stockQuantity=0;
    input.variants=Array.from({length:100},(_,position)=>({name:`Opção ${String(position)}`,attributes:{Número:String(position)},sku:null,
      priceCents:1000,costCents:null,compareAtPriceCents:null,stockQuantity:position+1,active:true,position}));
    const product=await save(input);
    expect(product?.variants).toHaveLength(100);
    expect(product?.variants.reduce((sum,v)=>sum+v.stockQuantity,0)).toBe(5050);
  });

});
