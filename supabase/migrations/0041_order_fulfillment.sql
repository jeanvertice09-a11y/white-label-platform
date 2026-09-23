create table public.order_fulfillments (
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  method text not null default 'delivery',
  status text not null default 'pending',
  recipient_name text,
  recipient_phone text,
  address_line1 text,
  address_line2 text,
  district text,
  city text,
  state text,
  postal_code text,
  carrier text,
  tracking_code text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id,store_id,order_id),
  foreign key (tenant_id,store_id,order_id) references public.orders(tenant_id,store_id,id) on delete cascade,
  constraint order_fulfillment_method_ck check(method in ('pickup','delivery','shipping')),
  constraint order_fulfillment_status_ck check(status in ('pending','ready','shipped','delivered','cancelled')),
  constraint order_fulfillment_tracking_url_ck check(tracking_url is null or tracking_url ~ '^https://')
);
create index order_fulfillments_status_idx on public.order_fulfillments(tenant_id,store_id,status,updated_at desc);
alter table public.order_fulfillments enable row level security;
revoke all on table public.order_fulfillments from public,anon,authenticated;