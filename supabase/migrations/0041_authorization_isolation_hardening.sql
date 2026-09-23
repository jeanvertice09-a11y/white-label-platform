-- 0041_authorization_isolation_hardening.sql — defense in depth for service-role scoped resources.
-- Browser writes remain denied by RLS; these constraints make cross-tenant/store
-- associations impossible even when privileged server code is used.

-- Actor attribution for store-scoped operational writes must belong to the same store.
alter table public.stock_movements
  add constraint stock_movements_created_by_scope_fk
  foreign key (store_id, created_by)
  references public.store_members (store_id, user_id)
  on delete set null (created_by);

