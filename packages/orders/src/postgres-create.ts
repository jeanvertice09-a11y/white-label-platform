import { getOrderById, ORDER_COLUMNS } from "./postgres-read.ts";
import { assertCreateOrderInput, assertOrderScope } from "./validation.ts";
import type { OrderSqlExecutor } from "./repository.ts";
import type {
  CreateOrderFromCartInput,
  Order,
  OrderScope,
} from "./types.ts";

export async function createOrderFromCart(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  input: CreateOrderFromCartInput,
): Promise<Order> {
  assertOrderScope(scope);
  assertCreateOrderInput(input);
  const payload = input.items.map((item) => ({
    product_id: item.productId,
    variant_id: item.variantId,
    qty: item.quantity,
  }));
  const rows = await sql.query(
    `with raw_input as (
       select * from jsonb_to_recordset($4::jsonb)
         as x(product_id uuid, variant_id uuid, qty integer)
     ), input as (
       select product_id,variant_id,sum(qty)::integer as qty
       from raw_input group by product_id,variant_id
     ), resolved as (
       select i.product_id,i.variant_id,i.qty,p.name as product_name,
         case when i.variant_id is null then null else v.name end as variant_name,
         coalesce(v.sku,p.sku) as sku_snapshot,
         case when i.variant_id is null then p.price_cents else v.price_cents end as unit_cents
       from input i
       join public.products p
         on p.tenant_id=$1 and p.store_id=$2 and p.id=i.product_id and p.active=true
       left join public.product_variants v
         on v.tenant_id=$1 and v.store_id=$2 and v.product_id=p.id
        and v.id=i.variant_id and v.active=true
       where i.qty between 1 and 999
         and (
           (i.variant_id is null and not exists (
             select 1 from public.product_variants av
             where av.tenant_id=$1 and av.store_id=$2
               and av.product_id=p.id and av.active=true
           ))
           or (i.variant_id is not null and v.id is not null)
         )
     ), valid as (
       select
         (select count(*) from input) as input_count,
         count(*) as resolved_count,
         coalesce(sum(qty * unit_cents),0)::bigint as subtotal
       from resolved
     ), existing as (
       select id from public.orders
       where tenant_id=$1 and store_id=$2 and idempotency_key=$3
     ), inserted as (
       insert into public.orders (
         tenant_id,store_id,origin,status,payment_status,customer_name,customer_phone,
         notes,subtotal_cents,discount_cents,shipping_cents,total_cents,idempotency_key
       )
       select $1,$2,$5,'pending','pending',$6,$7,$8,
         valid.subtotal,0,$9,valid.subtotal+$9,$3
       from valid
       where valid.input_count > 0
         and valid.input_count = valid.resolved_count
         and not exists (select 1 from existing)
       on conflict do nothing
       returning id
     ), selected_order as (
       select id from existing union all select id from inserted limit 1
     ), inserted_items as (
       insert into public.order_items (
         tenant_id,store_id,order_id,product_id,variant_id,product_name,
         variant_name,sku_snapshot,qty,unit_cents,total_cents
       )
       select $1,$2,inserted.id,r.product_id,r.variant_id,r.product_name,
         r.variant_name,r.sku_snapshot,r.qty,r.unit_cents,r.qty*r.unit_cents
       from inserted cross join resolved r
       returning id
     )
     select ${ORDER_COLUMNS} from public.orders
     where tenant_id=$1 and store_id=$2
       and id=(select id from selected_order)`,
    [
      scope.tenantId,
      scope.storeId,
      input.idempotencyKey,
      JSON.stringify(payload),
      input.origin,
      input.customerName,
      input.customerPhone,
      input.notes,
      input.shippingCents,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Carrinho inválido ou produto indisponível");
  const order = await getOrderById(sql, scope, String(row["id"]));
  if (!order) throw new Error("Pedido não encontrado após criação");
  return order;
}
