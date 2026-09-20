-- Plano operacional de homologação. NÃO executar sem revisar explicitamente.
-- Cria somente UM public.plans para Kataluu -> White Label; não cria subscription,
-- invoice, payment, tenant, Auth ou qualquer outro registro.
-- Moeda não pertence ao contrato de public.plans; BRL é persistido nos fatos financeiros.

do $$
declare
  v_slug constant text := 'hml-white-label';
  v_name constant text := 'Homologação White Label';
  v_price_cents constant integer := 19900;
  v_billing_interval constant text := 'monthly';
begin
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug HML inválido';
  end if;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'name HML inválido';
  end if;
  if v_price_cents is null or v_price_cents < 0 then
    raise exception 'price_cents HML inválido';
  end if;
  if v_billing_interval not in ('monthly','quarterly','yearly') then
    raise exception 'billing_interval HML inválido';
  end if;
  if exists (select 1 from public.plans where slug = v_slug) then
    raise exception 'public.plans já contém o slug %; não sobrescrever automaticamente', v_slug;
  end if;

  insert into public.plans(slug,name,price_cents,active,billing_interval)
  values (v_slug,v_name,v_price_cents,true,v_billing_interval);
end $$;
