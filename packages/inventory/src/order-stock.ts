export interface OrderStockSqlFragments {
  prepareConsume: string;
  applyConsume: string;
  prepareRestore: string;
  applyRestore: string;
}

const PREPARE_CONSUME = `
, stock_needs as (
  select oi.tenant_id,oi.store_id,oi.product_id,oi.variant_id,sum(oi.qty)::integer as qty
  from public.order_items oi
  join candidate_pending cp on cp.id=oi.order_id
  join public.products p
    on p.tenant_id=oi.tenant_id and p.store_id=oi.store_id
   and p.id=oi.product_id and p.track_inventory=true
  where oi.product_id is not null
  group by oi.tenant_id,oi.store_id,oi.product_id,oi.variant_id
), stock_variant_needs as (
  select * from stock_needs where variant_id is not null
), stock_simple_needs as (
  select * from stock_needs where variant_id is null
), stock_variant_targets as materialized (
  select n.tenant_id,n.store_id,n.product_id,n.variant_id,n.qty,
    v.stock_quantity::integer as current_quantity
  from stock_variant_needs n
  join public.product_variants v
    on v.tenant_id=n.tenant_id and v.store_id=n.store_id
   and v.product_id=n.product_id and v.id=n.variant_id
  order by v.id
  for update of v
), stock_simple_targets as materialized (
  select n.tenant_id,n.store_id,n.product_id,null::uuid as variant_id,n.qty,
    p.stock_quantity::integer as current_quantity
  from stock_simple_needs n
  join public.products p
    on p.tenant_id=n.tenant_id and p.store_id=n.store_id and p.id=n.product_id
  where not exists (
    select 1 from public.product_variants v
    where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
  )
  order by p.id
  for update of p
), stock_targets as (
  select * from stock_variant_targets
  union all
  select * from stock_simple_targets
), stock_availability as (
  select
    (select count(*) from stock_targets)=(select count(*) from stock_needs)
    and not exists (
      select 1 from stock_targets where current_quantity < qty
    ) as allowed
)`;

const APPLY_CONSUME = `
, stock_movements_applied as (
  insert into public.stock_movements (
    tenant_id,store_id,product_id,variant_id,delta,reason,
    movement_type,reference_type,reference_id
  )
  select t.tenant_id,t.store_id,t.product_id,t.variant_id,-t.qty,
    'Confirmação de pedido','sale','order',c.id
  from stock_targets t cross join changed c
  on conflict do nothing
  returning tenant_id,store_id,product_id,variant_id,delta
), stock_variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer as delta
  from stock_movements_applied
  where variant_id is not null
  group by tenant_id,store_id,product_id,variant_id
), stock_updated_variants as (
  update public.product_variants v
  set stock_quantity=v.stock_quantity+d.delta,updated_at=now()
  from stock_variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id
    and v.product_id=d.product_id and v.id=d.variant_id
  returning v.id
), stock_product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer as delta
  from stock_movements_applied
  where variant_id is null
  group by tenant_id,store_id,product_id
), stock_updated_products as (
  update public.products p
  set stock_quantity=p.stock_quantity+d.delta,updated_at=now()
  from stock_product_delta d
  where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id
  returning p.id
)`;

const PREPARE_RESTORE = `
, stock_sales as (
  select sm.tenant_id,sm.store_id,sm.product_id,sm.variant_id,
    sum(-sm.delta)::integer as qty
  from public.stock_movements sm
  join candidate_cancel cc on cc.id=sm.reference_id
  where cc.previous_status<>'pending'
    and sm.tenant_id=$1 and sm.store_id=$2
    and sm.movement_type='sale'
    and sm.reference_type='order'
    and sm.reference_id=cc.id
    and sm.delta<0
    and sm.product_id is not null
  group by sm.tenant_id,sm.store_id,sm.product_id,sm.variant_id
), stock_restore_variant_targets as materialized (
  select s.tenant_id,s.store_id,s.product_id,s.variant_id,s.qty
  from stock_sales s
  join public.product_variants v
    on s.variant_id is not null
   and v.tenant_id=s.tenant_id and v.store_id=s.store_id
   and v.product_id=s.product_id and v.id=s.variant_id
  order by v.id
  for update of v
), stock_restore_simple_targets as materialized (
  select s.tenant_id,s.store_id,s.product_id,null::uuid as variant_id,s.qty
  from stock_sales s
  join public.products p
    on s.variant_id is null
   and p.tenant_id=s.tenant_id and p.store_id=s.store_id and p.id=s.product_id
  order by p.id
  for update of p
), stock_restore_targets as (
  select * from stock_restore_variant_targets
  union all
  select * from stock_restore_simple_targets
)`;

const APPLY_RESTORE = `
, stock_restore_movements as (
  insert into public.stock_movements (
    tenant_id,store_id,product_id,variant_id,delta,reason,
    movement_type,reference_type,reference_id
  )
  select t.tenant_id,t.store_id,t.product_id,t.variant_id,t.qty,
    'Cancelamento de pedido','cancellation','order',c.id
  from stock_restore_targets t cross join changed c
  on conflict do nothing
  returning tenant_id,store_id,product_id,variant_id,delta
), stock_restore_variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer as delta
  from stock_restore_movements
  where variant_id is not null
  group by tenant_id,store_id,product_id,variant_id
), stock_restored_variants as (
  update public.product_variants v
  set stock_quantity=v.stock_quantity+d.delta,updated_at=now()
  from stock_restore_variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id
    and v.product_id=d.product_id and v.id=d.variant_id
  returning v.id
), stock_restore_product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer as delta
  from stock_restore_movements
  where variant_id is null
  group by tenant_id,store_id,product_id
), stock_restored_products as (
  update public.products p
  set stock_quantity=p.stock_quantity+d.delta,updated_at=now()
  from stock_restore_product_delta d
  where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id
  returning p.id
)`;

export function orderStockSqlFragments(): OrderStockSqlFragments {
  return {
    prepareConsume: PREPARE_CONSUME,
    applyConsume: APPLY_CONSUME,
    prepareRestore: PREPARE_RESTORE,
    applyRestore: APPLY_RESTORE,
  };
}
