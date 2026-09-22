-- 0032_media_deletion_claim.sql
-- Atomically claims physical deletion only when no supported association references the asset.

create or replace function public.claim_media_asset_deletion(
  p_tenant_id uuid,
  p_store_id uuid,
  p_asset_id uuid
)
returns boolean
language plpgsql
set search_path = public
as $$
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
$$;

revoke all on function public.claim_media_asset_deletion(uuid, uuid, uuid) from public;
revoke all on function public.claim_media_asset_deletion(uuid, uuid, uuid) from anon;
revoke all on function public.claim_media_asset_deletion(uuid, uuid, uuid) from authenticated;
grant execute on function public.claim_media_asset_deletion(uuid, uuid, uuid) to service_role;
