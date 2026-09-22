-- 0030_media_assets.sql — authoritative media lifecycle for R2-backed uploads.
-- Migration only: do not execute manually. Existing legacy references remain valid until replaced.

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
    (kind in ('product','banner') and store_id is not null and object_key like (
      'tenants/' || lower(tenant_id::text) || '/stores/' || lower(store_id::text) || '/%'
    ))
    or
    (kind='logo' and store_id is null and object_key like ('tenants/' || lower(tenant_id::text) || '/logo/%'))
  ),
  constraint media_assets_deleted_state_ck check (
    (status='deleted' and deleted_at is not null) or (status<>'deleted' and deleted_at is null)
  ),
  unique (tenant_id, store_id, id, object_key),
  unique (tenant_id, id, public_url)
);

create index media_assets_store_status_idx on public.media_assets (tenant_id, store_id, status, created_at desc);
create index media_assets_tenant_status_idx on public.media_assets (tenant_id, status, created_at desc);

alter table public.product_images add column if not exists asset_id uuid;
alter table public.product_images
  add constraint product_images_asset_fk
    foreign key (tenant_id, store_id, asset_id, object_key)
    references public.media_assets (tenant_id, store_id, id, object_key)
    on delete restrict;
create index product_images_asset_idx on public.product_images (tenant_id, store_id, asset_id) where asset_id is not null;

alter table public.store_banners add column if not exists asset_id uuid;
alter table public.store_banners
  add constraint store_banners_asset_fk
    foreign key (tenant_id, store_id, asset_id, image_object_key)
    references public.media_assets (tenant_id, store_id, id, object_key)
    on delete restrict;
create index store_banners_asset_idx on public.store_banners (tenant_id, store_id, asset_id) where asset_id is not null;

alter table public.tenant_branding add column if not exists logo_asset_id uuid;
alter table public.tenant_branding
  add constraint tenant_branding_logo_asset_fk
    foreign key (tenant_id, logo_asset_id, logo_url)
    references public.media_assets (tenant_id, id, public_url)
    on delete restrict;
create index tenant_branding_logo_asset_idx on public.tenant_branding (tenant_id, logo_asset_id) where logo_asset_id is not null;

-- Preserve legacy references while removing arbitrary key authority.
-- A new key must resolve to a READY asset in the same scope. Existing legacy keys
-- can only be reused inside the same store, which keeps historical duplication working.
create or replace function public.bind_product_image_media_asset()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare resolved uuid;
begin
  if tg_op='UPDATE' and new.object_key is not distinct from old.object_key
     and new.asset_id is not distinct from old.asset_id then return new; end if;
  select id into resolved from public.media_assets
  where tenant_id=new.tenant_id and store_id=new.store_id
    and object_key=new.object_key and kind='product' and status='ready' limit 1;
  if resolved is not null then new.asset_id := resolved; return new; end if;
  if exists (select 1 from public.product_images legacy
    where legacy.tenant_id=new.tenant_id and legacy.store_id=new.store_id
      and legacy.object_key=new.object_key and legacy.asset_id is null) then
    new.asset_id := null; return new;
  end if;
  raise exception 'product media asset is not ready in this store' using errcode='23514';
end;
$$;

drop trigger if exists product_images_bind_media_asset on public.product_images;
create trigger product_images_bind_media_asset
before insert or update of object_key, asset_id on public.product_images
for each row execute function public.bind_product_image_media_asset();

create or replace function public.bind_store_banner_media_asset()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare resolved uuid;
begin
  if tg_op='UPDATE' and new.image_object_key is not distinct from old.image_object_key
     and new.asset_id is not distinct from old.asset_id then return new; end if;
  select id into resolved from public.media_assets
  where tenant_id=new.tenant_id and store_id=new.store_id
    and object_key=new.image_object_key and kind='banner' and status='ready' limit 1;
  if resolved is not null then new.asset_id := resolved; return new; end if;
  if exists (select 1 from public.store_banners legacy
    where legacy.tenant_id=new.tenant_id and legacy.store_id=new.store_id
      and legacy.image_object_key=new.image_object_key and legacy.asset_id is null) then
    new.asset_id := null; return new;
  end if;
  raise exception 'banner media asset is not ready in this store' using errcode='23514';
end;
$$;

drop trigger if exists store_banners_bind_media_asset on public.store_banners;
create trigger store_banners_bind_media_asset
before insert or update of image_object_key, asset_id on public.store_banners
for each row execute function public.bind_store_banner_media_asset();

create or replace function public.assert_tenant_logo_media_asset()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op='UPDATE' and new.logo_asset_id is not distinct from old.logo_asset_id
     and new.logo_url is not distinct from old.logo_url then return new; end if;
  if new.logo_asset_id is null then return new; end if;
  if not exists (select 1 from public.media_assets m
    where m.tenant_id=new.tenant_id and m.store_id is null and m.id=new.logo_asset_id
      and m.public_url=new.logo_url and m.kind='logo' and m.status='ready') then
    raise exception 'tenant logo media asset is not ready in this tenant' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_branding_assert_logo_media_asset on public.tenant_branding;
create trigger tenant_branding_assert_logo_media_asset
before insert or update of logo_asset_id, logo_url on public.tenant_branding
for each row execute function public.assert_tenant_logo_media_asset();

alter table public.media_assets enable row level security;

-- No anon/authenticated policy. Lifecycle writes cross the authorized server boundary only.
