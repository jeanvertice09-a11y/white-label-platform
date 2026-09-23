-- Store-level recovery jobs for payments and shipments.
alter table public.operational_jobs drop constraint operational_jobs_kind_check;
alter table public.operational_jobs add constraint operational_jobs_kind_check check (kind in ('email.send','media.process','billing.reconcile','domain.verify','store_payment.reconcile','shipment.recover'));
create index operational_jobs_store_kind_status_idx on public.operational_jobs(tenant_id,store_id,kind,status,created_at desc) where store_id is not null;
