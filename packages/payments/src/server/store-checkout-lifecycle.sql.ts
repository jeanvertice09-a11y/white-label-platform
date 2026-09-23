// Atomic store-checkout payment → order → inventory transition.
export const APPLY_STATUS_SQL = `with payment_candidate as (
  select p.id,p.tenant_id,p.store_id,p.order_id,p.status
  from public.payments p
  where p.id=$1::uuid and p.gateway_account_id=$2::uuid
  for update
), changed as (
  update public.payments
  set status=$3,
      provider_updated_at=coalesce($4::timestamptz,provider_updated_at,now()),
      updated_at=now()
  from payment_candidate pc
  where public.payments.id=pc.id and public.payments.gateway_account_id=$2::uuid
    and status is distinct from $3
    and (
      (status='pending' and $3 in ('authorized','captured','failed','refunded','chargeback'))
      or (status='authorized' and $3 in ('captured','failed','refunded','chargeback'))
      or (status='captured' and $3 in ('refunded','chargeback'))
    )
    and (
      $4::timestamptz is null
      or provider_updated_at is null
      or $4::timestamptz >= provider_updated_at
    )
  returning id,tenant_id,store_id,order_id,status
), order_locked as materialized (
  select o.id,o.tenant_id,o.store_id,o.status,o.payment_status
  from public.orders o join changed c
    on c.order_id=o.id and c.tenant_id=o.tenant_id and c.store_id=o.store_id
  where c.order_id is not null
  for update of o
), stock_needs as (
  select oi.tenant_id,oi.store_id,oi.product_id,oi.variant_id,sum(oi.qty)::integer qty
  from public.order_items oi join changed c on c.order_id=oi.order_id
  join order_locked ol on ol.id=c.order_id
  join public.products p on p.tenant_id=oi.tenant_id and p.store_id=oi.store_id and p.id=oi.product_id and p.track_inventory=true
  where c.status='captured' and ol.status='pending' and oi.product_id is not null
  group by oi.tenant_id,oi.store_id,oi.product_id,oi.variant_id
), stock_variant_targets as materialized (
  select n.*,v.stock_quantity::integer current_quantity from stock_needs n
  join public.product_variants v on n.variant_id is not null and v.tenant_id=n.tenant_id and v.store_id=n.store_id and v.product_id=n.product_id and v.id=n.variant_id
  order by v.id for update of v
), stock_simple_targets as materialized (
  select n.*,p.stock_quantity::integer current_quantity from stock_needs n
  join public.products p on n.variant_id is null and p.tenant_id=n.tenant_id and p.store_id=n.store_id and p.id=n.product_id
  order by p.id for update of p
), stock_targets as (select * from stock_variant_targets union all select * from stock_simple_targets),
stock_guard as (
  select not exists(select 1 from stock_needs) or (
    (select count(*) from stock_targets)=(select count(*) from stock_needs)
    and not exists(select 1 from stock_targets where current_quantity<qty)
  ) ok
), order_change as (
  update public.orders o
  set payment_status=case
      when c.status='captured' then 'paid'
      when c.status in ('failed','chargeback') then 'failed'
      when c.status='refunded' then 'refunded'
      else o.payment_status end,
    status=case
      when c.status='captured' and ol.status='pending' then 'confirmed'
      when c.status in ('failed','chargeback','refunded') and ol.status in ('pending','confirmed','preparing','ready') then 'cancelled'
      else o.status end,
    confirmed_at=case when c.status='captured' and ol.status='pending' then coalesce(o.confirmed_at,now()) else o.confirmed_at end,
    cancelled_at=case when c.status in ('failed','chargeback','refunded') and ol.status in ('pending','confirmed','preparing','ready') then coalesce(o.cancelled_at,now()) else o.cancelled_at end,
    updated_at=now()
  from changed c join order_locked ol on ol.id=c.order_id cross join stock_guard sg
  where o.id=ol.id and (c.status<>'captured' or ol.status<>'pending' or sg.ok) and o.tenant_id=ol.tenant_id and o.store_id=ol.store_id
  returning o.id,o.tenant_id,o.store_id,ol.status previous_status,o.status,c.status payment_status
), stock_sales as (
  insert into public.stock_movements(tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,reference_type,reference_id)
  select t.tenant_id,t.store_id,t.product_id,t.variant_id,-t.qty,'Pagamento aprovado','sale','order',oc.id
  from stock_targets t join order_change oc on oc.tenant_id=t.tenant_id and oc.store_id=t.store_id cross join stock_guard g
  where g.ok
  on conflict do nothing returning tenant_id,store_id,product_id,variant_id,delta
), variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer delta from stock_sales where variant_id is not null group by 1,2,3,4
), variant_update as (
  update public.product_variants v set stock_quantity=v.stock_quantity+d.delta,updated_at=now() from variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id and v.product_id=d.product_id and v.id=d.variant_id returning v.id
), product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer delta from stock_sales where variant_id is null group by 1,2,3
), product_update as (
  update public.products p set stock_quantity=p.stock_quantity+d.delta,updated_at=now() from product_delta d
  where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id returning p.id
), restore_source as (
  select sm.tenant_id,sm.store_id,sm.product_id,sm.variant_id,sum(-sm.delta)::integer qty,oc.id order_id
  from public.stock_movements sm join order_change oc on oc.id=sm.reference_id
  where oc.payment_status in ('failed','chargeback','refunded') and oc.previous_status<>'pending'
    and sm.movement_type='sale' and sm.reference_type='order' and sm.delta<0
  group by sm.tenant_id,sm.store_id,sm.product_id,sm.variant_id,oc.id
), stock_returns as (
  insert into public.stock_movements(tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,reference_type,reference_id)
  select tenant_id,store_id,product_id,variant_id,qty,'Pagamento cancelado/reembolsado','cancellation','order',order_id from restore_source
  on conflict do nothing returning tenant_id,store_id,product_id,variant_id,delta
), return_variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer delta from stock_returns where variant_id is not null group by 1,2,3,4
), return_variant_update as (
  update public.product_variants v set stock_quantity=v.stock_quantity+d.delta,updated_at=now() from return_variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id and v.product_id=d.product_id and v.id=d.variant_id returning v.id
), return_product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer delta from stock_returns where variant_id is null group by 1,2,3
), return_product_update as (
  update public.products p set stock_quantity=p.stock_quantity+d.delta,updated_at=now() from return_product_delta d
  where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id returning p.id
), order_audit as (
  insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
  select null,tenant_id,store_id,'order.payment_transition','order',id::text,
    jsonb_build_object('from',previous_status,'to',case when payment_status='captured' then 'confirmed' else 'cancelled' end,'payment_status',payment_status)
  from order_change where status is distinct from previous_status returning id
), audit as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
  )
  select null,tenant_id,store_id,'payment.status_changed','payment',id::text,
    jsonb_build_object('status',status,'source','provider_reconciliation')
  from changed returning id
)
select exists(select 1 from changed) changed`;
