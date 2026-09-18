import type {
  InventoryItem,
  InventoryScope,
  StockAdjustmentInput,
} from "./types.ts";
import type {
  InventoryRepository,
  InventorySqlExecutor,
} from "./repository.ts";

function assertScope(scope: InventoryScope): void {
  if (!scope.tenantId || !scope.storeId) throw new Error("Escopo de estoque inválido");
}

function mapItem(row: Record<string, unknown>): InventoryItem {
  return {
    tenantId: String(row["tenant_id"]),
    storeId: String(row["store_id"]),
    productId: String(row["product_id"]),
    variantId: row["variant_id"] === null ? null : String(row["variant_id"]),
    productName: String(row["product_name"]),
    variantName: row["variant_name"] === null ? null : String(row["variant_name"]),
    sku: row["sku"] === null ? null : String(row["sku"]),
    trackInventory: Boolean(row["track_inventory"]),
    currentQuantity: Number(row["current_quantity"]),
  };
}

async function list(
  sql: InventorySqlExecutor,
  scope: InventoryScope,
): Promise<InventoryItem[]> {
  assertScope(scope);
  const rows = await sql.query(
    `with variant_rows as (
       select p.tenant_id,p.store_id,p.id as product_id,v.id as variant_id,
         p.name as product_name,v.name as variant_name,coalesce(v.sku,p.sku) as sku,
         p.track_inventory,
         coalesce(sum(sm.delta),0)::integer as current_quantity
       from public.products p
       join public.product_variants v
         on v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
       left join public.stock_movements sm
         on sm.tenant_id=v.tenant_id and sm.store_id=v.store_id
        and sm.product_id=v.product_id and sm.variant_id=v.id
       where p.tenant_id=$1 and p.store_id=$2
       group by p.tenant_id,p.store_id,p.id,v.id,p.name,v.name,v.sku,p.sku,p.track_inventory
     ), product_rows as (
       select p.tenant_id,p.store_id,p.id as product_id,null::uuid as variant_id,
         p.name as product_name,null::text as variant_name,p.sku,p.track_inventory,
         coalesce(sum(sm.delta),0)::integer as current_quantity
       from public.products p
       left join public.stock_movements sm
         on sm.tenant_id=p.tenant_id and sm.store_id=p.store_id
        and sm.product_id=p.id and sm.variant_id is null
       where p.tenant_id=$1 and p.store_id=$2
         and not exists (
           select 1 from public.product_variants v
           where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
         )
       group by p.tenant_id,p.store_id,p.id,p.name,p.sku,p.track_inventory
     )
     select * from variant_rows
     union all select * from product_rows
     order by product_name,variant_name nulls first`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapItem);
}

async function adjust(
  sql: InventorySqlExecutor,
  scope: InventoryScope,
  input: StockAdjustmentInput,
): Promise<number> {
  assertScope(scope);
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new Error("Ajuste inválido");
  if (!input.reason.trim() || input.reason.length > 240) throw new Error("Motivo inválido");
  const rows = await sql.query(
    `with movement as (
       insert into public.stock_movements (
         tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,created_by
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning tenant_id,store_id,product_id,variant_id,delta
     ), variant_update as (
       update public.product_variants v
       set stock_quantity=v.stock_quantity+m.delta,updated_at=now()
       from movement m
       where m.variant_id is not null
         and v.tenant_id=m.tenant_id and v.store_id=m.store_id
         and v.product_id=m.product_id and v.id=m.variant_id
       returning v.stock_quantity
     ), product_update as (
       update public.products p
       set stock_quantity=p.stock_quantity+m.delta,updated_at=now()
       from movement m
       where m.variant_id is null
         and p.tenant_id=m.tenant_id and p.store_id=m.store_id and p.id=m.product_id
       returning p.stock_quantity
     )
     select stock_quantity from variant_update
     union all select stock_quantity from product_update`,
    [
      scope.tenantId,
      scope.storeId,
      input.productId,
      input.variantId,
      input.delta,
      input.reason.trim(),
      input.type,
      input.createdBy,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Produto ou variante não encontrado");
  return Number(row["stock_quantity"]);
}

export function createInventoryRepository(
  sql: InventorySqlExecutor,
): InventoryRepository {
  return {
    list: (scope) => list(sql, scope),
    adjust: (scope, input) => adjust(sql, scope, input),
  };
}
