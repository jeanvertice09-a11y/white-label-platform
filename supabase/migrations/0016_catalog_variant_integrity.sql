-- 0016_catalog_variant_integrity.sql
-- Impede combinações de atributos duplicadas no mesmo produto/store.
-- A combinação vazia continua permitida para variantes legadas/nomeadas sem atributos.

alter table public.product_variants
  add constraint product_variants_attributes_object_ck
  check (jsonb_typeof(attributes) = 'object');

create unique index product_variants_attributes_uidx
  on public.product_variants (tenant_id, store_id, product_id, attributes)
  where attributes <> '{}'::jsonb;
