-- 0037_suspension_public_helper_hardening.sql — public compatibility helpers are backend-only.
revoke all on function public.is_tenant_member(uuid) from public, anon, authenticated;
revoke all on function public.is_store_member(uuid) from public, anon, authenticated;
grant execute on function public.is_tenant_member(uuid) to service_role;
grant execute on function public.is_store_member(uuid) to service_role;
