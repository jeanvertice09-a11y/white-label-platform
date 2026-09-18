import { getOrderById } from "./postgres-read.ts";
import { assertCreateOrderInput, assertOrderScope } from "./validation.ts";
import type { OrderSqlExecutor } from "./repository.ts";
import type {
  CreateOrderFromCartInput,
  Order,
  OrderScope,
} from "./types.ts";

const CREATE_ORDER_SQL = `with raw_input as (
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
), coupon_eval as (
  select c.id,c.code,
    case
      when c.discount_type='percentage'
        then least(v.subtotal, floor(v.subtotal*c.discount_value/100.0)::bigint)
      else least(v.subtotal,c.discount_value)
    end as discount_cents
  from public.coupons c cross join valid v
  where $9::text is not null
    and c.tenant_id=$1 and c.store_id=$2 and c.code=$9
    and c.active=true
    and (c.starts_at is null or c.starts_at<=now())
    and (c.ends_at is null or c.ends_at>now())
    and (c.usage_limit is null or c.usage_count<c.usage_limit)
    and (c.minimum_order_cents is null or v.subtotal>=c.minimum_order_cents)
  for update of c
), priced as (
  select v.*,ce.id as coupon_id,ce.code as coupon_code,
    coalesce(ce.discount_cents,0)::bigint as discount_cents
  from valid v left join coupon_eval ce on true
), customer_match as (
  select c.id,c.name,c.phone
  from public.customers c
  where c.tenant_id=$1 and c.store_id=$2
    and (
      ($6::uuid is not null and c.id=$6)
      or ($6::uuid is null and $8::text is not null and c.phone=$8)
    )
  limit 1
), existing as (
  select id from public.orders
  where tenant_id=$1 and store_id=$2 and idempotency_key=$3
), inserted as (
  insert into public.orders (
    tenant_id,store_id,origin,status,payment_status,customer_id,customer_name,
    customer_phone,coupon_id,coupon_code_snapshot,notes,subtotal_cents,
    discount_cents,shipping_cents,total_cents,idempotency_key
  )
  select $1,$2,$5,'pending','pending',cm.id,coalesce($7,cm.name),coalesce($8,cm.phone),
    p.coupon_id,p.coupon_code,$10,p.subtotal,p.discount_cents,$11,
    p.subtotal-p.discount_cents+$11,$3
  from priced p left join customer_match cm on true
  where p.input_count > 0
    and p.input_count = p.resolved_count
    and ($6::uuid is null or cm.id is not null)
    and ($9::text is null or p.coupon_id is not null)
    and not exists (select 1 from existing)
  on conflict do nothing
  returning id,coupon_id
), coupon_used as (
  update public.coupons c
  set usage_count=c.usage_count+1,updated_at=now()
  from inserted i
  where i.coupon_id is not null
    and c.tenant_id=$1 and c.store_id=$2 and c.id=i.coupon_id
  returning c.id
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
select id from selected_order`;

function cartPayload(input: CreateOrderFromCartInput): string {
  return JSON.stringify(input.items.map((item) => ({
    product_id: item.productId,
    variant_id: item.variantId,
    qty: item.quantity,
  })));
}

function orderParams(
  scope: OrderScope,
  input: CreateOrderFromCartInput,
): unknown[] {
  return [
    scope.tenantId,
    scope.storeId,
    input.idempotencyKey,
    cartPayload(input),
    input.origin,
    input.customerId ?? null,
    input.customerName,
    input.customerPhone,
    input.couponCode?.trim().toUpperCase() ?? null,
    input.notes,
    input.shippingCents,
  ];
}

export async function createOrderFromCart(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  input: CreateOrderFromCartInput,
): Promise<Order> {
  assertOrderScope(scope);
  assertCreateOrderInput(input);
  const rows = await sql.query(CREATE_ORDER_SQL, orderParams(scope, input));
  if (rows.length === 0) {
    throw new Error("Carrinho, cliente ou cupom inválido");
  }
  const order = await getOrderById(sql, scope, String(rows[0]["id"]));
  if (!order) throw new Error("Pedido não encontrado após criação");
  return order;
}
