-- 0030_media_assets.sql — finaliza o inventário de mídia existente para uploads R2 reais.
-- A tabela public.media_assets já existe desde 0002; esta migration a endurece sem recriá-la.

alter table public.media_assets rename column mime to content_type;

alter table public.media_assets
  add column public_url text,
  add column kind text,
  add column status text not null default 'legacy',
  add column upload_expires_at timestamptz,
  add column created_by uuid,
  add column last_error text,
  add column deleted_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint media_assets_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  add constraint media_assets_tenant_store_id_uidx unique (tenant_id, store_id, id),
  add constraint media_assets_tenant_id_uidx unique (tenant_id, id),
  add constraint media_assets_runtime_ck check (
    status = 'legacy'
    or (
      kind in ('product','banner','logo')
      and content_type in ('image/jpeg','image/png','image/webp')
      and size_bytes > 0 and size_bytes <= 10485760
      and public_url is not null
      and upload_expires_at is not null
      and (
        (kind in ('product','banner') and store_id is not null
          and object_key like ('tenants/' || lower(tenant_id::text) || '/stores/' || lower(store_id::text) || '/%'))
        or
        (kind = 'logo' and store_id is null
          and object_key like ('tenants/' || lower(tenant_id::text) || '/logo/%'))
      )
    )
  ),
  add constraint media_assets_status_ck check (
    status in ('legacy','pending','ready','delete_pending','deleted','failed')
  ),
  add constraint media_assets_deleted_state_ck check (
    (status = 'deleted' and deleted_at is not null)
    or (status <> 'deleted' and deleted_at is null)
  );

create unique index media_assets_runtime_object_key_uidx
  on public.media_assets (object_key)
  where status <> 'legacy';
create index media_assets_store_status_idx
  on public.media_assets (tenant_id, store_id, status, created_at desc);
create index media_assets_tenant_status_idx
  on public.media_assets (tenant_id, status, created_at desc);

alter table public.product_images add column asset_id uuid;
alter table public.product_images
  add constraint product_images_asset_fk
    foreign key (tenant_id, store_id, asset_id)
    references public.media_assets (tenant_id, store_id, id)
    on delete restrict;

alter table public.store_banners add column asset_id uuid;
alter table public.store_banners
  add constraint store_banners_asset_fk
    foreign key (tenant_id, store_id, asset_id)
    references public.media_assets (tenant_id, store_id, id)
    on delete restrict;

alter table public.tenant_branding add column logo_asset_id uuid;
alter table public.tenant_branding
  add constraint tenant_branding_logo_asset_fk
    foreign key (tenant_id, logo_asset_id)
    references public.media_assets (tenant_id, id)
    on delete restrict;

create or replace function public.bind_store_media_asset()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_kind text;
  expected_key text;
  bound_asset uuid;
begin
  if TG_TABLE_NAME = 'product_images' then
    expected_kind := 'product';
    expected_key := NEW.object_key;
  elsif TG_TABLE_NAME = 'store_banners' then
    expected_kind := 'banner';
    expected_key := NEW.image_object_key;
  else
    raise exception 'unsupported media association table';
  end if;

  if NEW.asset_id is null then
    -- Compatibilidade: referências antigas que nunca tiveram media_asset continuam válidas.
    -- Se a key já pertence ao inventário novo, porém, ela obrigatoriamente precisa estar
    -- READY, no mesmo tenant/store e com o kind correto.
    select a.id into bound_asset
    from public.media_assets a
    where a.tenant_id = NEW.tenant_id
      and a.store_id = NEW.store_id
      and a.object_key = expected_key
      and a.kind = expected_kind
      and a.status = 'ready'
    limit 1;
    if bound_asset is not null then
      NEW.asset_id := bound_asset;
      return NEW;
    end if;
    if exists (
      select 1 from public.media_assets a
      where a.status <> 'legacy' and a.object_key = expected_key
    ) then
      raise exception 'media asset is not READY for this store';
    end if;
    return NEW;
  end if;

  perform 1
  from public.media_assets a
  where a.id = NEW.asset_id
    and a.tenant_id = NEW.tenant_id
    and a.store_id = NEW.store_id
    and a.object_key = expected_key
    and a.kind = expected_kind
    and a.status = 'ready';
  if not found then
    raise exception 'media asset association mismatch';
  end if;
  return NEW;
end;
$$;

create trigger product_images_media_bind_insert
  before insert on public.product_images
  for each row execute function public.bind_store_media_asset();
create trigger product_images_media_bind_update
  before update of tenant_id, store_id, object_key, asset_id on public.product_images
  for each row execute function public.bind_store_media_asset();
create trigger store_banners_media_bind_insert
  before insert on public.store_banners
  for each row execute function public.bind_store_media_asset();
create trigger store_banners_media_bind_update
  before update of tenant_id, store_id, image_object_key, asset_id on public.store_banners
  for each row execute function public.bind_store_media_asset();

create or replace function public.validate_tenant_logo_asset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- logo_asset_id nulo preserva branding legado; novas associações de upload usam asset_id.
  if NEW.logo_asset_id is null then
    return NEW;
  end if;
  perform 1
  from public.media_assets a
  where a.id = NEW.logo_asset_id
    and a.tenant_id = NEW.tenant_id
    and a.store_id is null
    and a.kind = 'logo'
    and a.status = 'ready'
    and a.public_url = NEW.logo_url;
  if not found then
    raise exception 'tenant logo asset mismatch';
  end if;
  return NEW;
end;
$$;

create trigger tenant_branding_logo_asset_guard_insert
  before insert on public.tenant_branding
  for each row execute function public.validate_tenant_logo_asset();
create trigger tenant_branding_logo_asset_guard_update
  before update of logo_url, logo_asset_id on public.tenant_branding
  for each row execute function public.validate_tenant_logo_asset();

create or replace function public.claim_media_asset_deletion(
  p_tenant_id uuid,
  p_store_id uuid,
  p_asset_id uuid
)
returns boolean
language plpgsql
set search_path = public
as $
declare
  claimed_id uuid;
begin
  update public.media_assets a
  set status = 'delete_pending', last_error = null, updated_at = now()
  where a.tenant_id = p_tenant_id
    and a.store_id is not distinct from p_store_id
    and a.id = p_asset_id
    and a.status in ('pending','ready','failed','delete_pending')
    and not exists (
      select 1 from public.product_images i
      where i.tenant_id = a.tenant_id
        and i.store_id is not distinct from a.store_id
        and i.asset_id = a.id
    )
    and not exists (
      select 1 from public.store_banners b
      where b.tenant_id = a.tenant_id
        and b.store_id is not distinct from a.store_id
        and b.asset_id = a.id
    )
    and not exists (
      select 1 from public.tenant_branding tb
      where tb.tenant_id = a.tenant_id
        and a.store_id is null
        and tb.logo_asset_id = a.id
    )
  returning a.id into claimed_id;

  return claimed_id is not null;
end;
$;

revoke all on function public.claim_media_asset_deletion(uuid, uuid, uuid) from public;
revoke all on function public.claim_media_asset_deletion(uuid, uuid, uuid) from anon;
revoke all on function public.claim_media_asset_deletion(uuid, uuid, uuid) from authenticated;
grant execute on function public.claim_media_asset_deletion(uuid, uuid, uuid) to service_role;

alter table public.media_assets enable row level security;
-- Nenhuma policy de browser: mutações passam pela boundary server-side autorizada/service_role.
