-- Fields present in the supplied Katálu product editor. Existing store RLS stays in force.
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products alter column pix_discount_percent type numeric(5,2) using pix_discount_percent::numeric(5,2);
alter table public.products add constraint products_barcode_length check (barcode is null or char_length(barcode) <= 180);

alter table public.products add column if not exists deleted_at timestamptz;
