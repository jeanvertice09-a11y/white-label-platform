import type { Product } from "../../packages/catalog/src/types.ts";
import type { ProductEditorInput } from "../../apps/web/src/lib/server/product-editor.schema.ts";
export const sample: Product = {id:"11111111-1111-4111-8111-111111111111",tenantId:"22222222-2222-4222-8222-222222222222",storeId:"33333333-3333-4333-8333-333333333333",name:"Tênis original",slug:"tenis-original",description:"",sku:"",categoryId:null,categoryIds:[],priceCents:9900,compareAtPriceCents:null,costCents:null,discountType:null,discountValue:null,pixDiscountPercent:0,freeShipping:false,active:true,trackInventory:true,stockQuantity:6,position:0,variants:[],images:[],featured:false,barcode:null};
declare global { interface Window { editorSaved?:ProductEditorInput; editorProduct?:Product; editorUploads?:string[]; } }
export function saveMerchantProductEditor({data}:Readonly<{data:ProductEditorInput}>):Promise<Product> {
  window.editorSaved=data;
  const product:Product={...sample,...data.input,variants:data.variants.map((v,i)=>({...v,id:v.id??`44444444-4444-4444-8444-${String(i).padStart(12,"0")}`,productId:sample.id,tenantId:sample.tenantId,storeId:sample.storeId})),images:[]};
  window.editorProduct=product;
  return Promise.resolve(product);
}
export function uploadMerchantMedia(file:File,_kind:string) { window.editorUploads=[...(window.editorUploads??[]),file.name];return Promise.resolve({id:crypto.randomUUID()}); }
export function discardUploadedMerchantMedia(_id:string){return Promise.resolve();}
export function setMerchantPrimaryProductImage(_data:unknown){return Promise.resolve();}
export function createUploadedProductImage(_data:unknown){return Promise.resolve();}
export function removeUploadedProductImage(_data:unknown){return Promise.resolve();}
export function updateUploadedProductImage(_data:unknown){return Promise.resolve();}
