import { assertVariantInput } from "@white-label/catalog";
import type { CatalogScope,CatalogSqlExecutor } from "@white-label/catalog";
import type { ProductEditorInput } from "./product-editor.schema.ts";
const RECORDS = `id uuid,name text,sku text,attributes jsonb,price_cents bigint,compare_at_price_cents bigint,cost_cents bigint,active boolean,position integer`;
function combination(attributes:Record<string,string>):string { return JSON.stringify(Object.entries(attributes).sort(([a],[b])=>a.localeCompare(b))); }
function validate(data:ProductEditorInput,productId:string):void {
  const combinations=new Set<string>(),ids=new Set<string>();
  for(const v of data.variants){
    assertVariantInput({...v,productId});
    if(v.id&&ids.has(v.id))throw new Error("Variação repetida no produto");
    if(v.id)ids.add(v.id);
    const key=combination(v.attributes);
    if(Object.keys(v.attributes).length&&combinations.has(key))throw new Error("Combinação de variante já cadastrada");
    combinations.add(key);
  }
}
export async function saveEditorVariants(sql:CatalogSqlExecutor,scope:CatalogScope,productId:string,data:ProductEditorInput,actor:string|null):Promise<void>{
  validate(data,productId);
  const current=await sql.query("select id,stock_quantity,attributes from public.product_variants where tenant_id=$1 and store_id=$2 and product_id=$3 for update",[scope.tenantId,scope.storeId,productId]);
  const byId=new Map(current.map(v=>[String(v["id"]),v]));
  const retained=new Set(data.variants.flatMap(v=>v.id?[v.id]:[]));
  const existingCombinations=new Set(current.filter(v=>!retained.has(String(v["id"]))).map(v=>combination(v["attributes"] as Record<string,string>)));
  const records=data.variants.map(v=>{
    const previous=v.id?byId.get(v.id):undefined;
    if(v.id&&!previous)throw new Error("Variação não encontrada neste produto");
    if(Object.keys(v.attributes).length&&existingCombinations.has(combination(v.attributes)))throw new Error("Combinação de variante já cadastrada");
    const quantity=Number(previous?.["stock_quantity"]??0),expected=v.expectedStockQuantity;
    if(expected!==undefined&&v.stockQuantity!==expected&&quantity!==expected)throw new Error("O estoque mudou durante a edição. Recarregue o produto antes de salvar a quantidade.");
    return {id:v.id??crypto.randomUUID(),name:v.name,sku:v.sku,attributes:v.attributes,price_cents:v.priceCents,
      compare_at_price_cents:v.compareAtPriceCents,cost_cents:v.costCents,active:v.active,position:v.position,
      delta:(v.stockQuantity===expected?quantity:v.stockQuantity)-quantity,operation_id:crypto.randomUUID(),existing:Boolean(v.id)};
  });
  if(!records.length)return;
  const params=[scope.tenantId,scope.storeId,productId];
  const added=records.filter(v=>!v.existing),changed=records.filter(v=>v.existing);
  if(added.length)await sql.query(`insert into public.product_variants(tenant_id,store_id,product_id,id,name,sku,attributes,price_cents,compare_at_price_cents,cost_cents,active,stock_quantity,position)
    select $1,$2,$3,r.id,r.name,r.sku,r.attributes,r.price_cents,r.compare_at_price_cents,r.cost_cents,r.active,0,r.position
    from jsonb_to_recordset($4::jsonb) as r(${RECORDS}) returning id`,[...params,JSON.stringify(added)]);
  if(changed.length)await sql.query(`update public.product_variants v set name=r.name,sku=r.sku,attributes=r.attributes,price_cents=r.price_cents,
    compare_at_price_cents=r.compare_at_price_cents,cost_cents=r.cost_cents,active=r.active,position=r.position,updated_at=now()
    from jsonb_to_recordset($4::jsonb) as r(${RECORDS}) where v.tenant_id=$1 and v.store_id=$2 and v.product_id=$3 and v.id=r.id returning v.id`,[...params,JSON.stringify(changed)]);
  await sql.query(`with movements as (
    insert into public.stock_movements(tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,reference_type,reference_id,created_by)
    select $1,$2,$3,r.id,r.delta,'Quantidade definida no cadastro ou edição do produto','adjustment','inventory_operation',r.operation_id,$5::uuid
    from jsonb_to_recordset($4::jsonb) as r(id uuid,delta integer,operation_id uuid) where r.delta<>0 returning variant_id,delta
  ) update public.product_variants v set stock_quantity=v.stock_quantity+m.delta,updated_at=now() from movements m
    where v.tenant_id=$1 and v.store_id=$2 and v.product_id=$3 and v.id=m.variant_id returning v.id`,[...params,JSON.stringify(records),actor]);
}
