-- TEMPORARY CI DIAGNOSTIC: media_assets table only.
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid,
  object_key text not null unique,
  public_url text not null,
  kind text not null check (kind in ('product','banner','logo')),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  status text not null default 'pending' check (status in ('pending','ready','delete_pending','deleted','failed')),
  upload_expires_at timestamptz not null,
  created_by uuid,
  last_error text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  constraint media_assets_scope_key_ck check (
    (kind in ('product','banner') and store_id is not null and object_key like ('tenants/' || lower(tenant_id::text) || '/stores/' || lower(store_id::text) || '/%'))
    or (kind='logo' and store_id is null and object_key like ('tenants/' || lower(tenant_id::text) || '/logo/%'))
  ),
  constraint media_assets_deleted_state_ck check ((status='deleted' and deleted_at is not null) or (status<>'deleted' and deleted_at is null)),
  unique (tenant_id, store_id, id, object_key),
  unique (tenant_id, id, public_url)
);
create index media_assets_store_status_idx on public.media_assets (tenant_id, store_id, status, created_at desc);
create index media_assets_tenant_status_idx on public.media_assets (tenant_id, status, created_at desc);
alter table public.media_assets enable row level security;
