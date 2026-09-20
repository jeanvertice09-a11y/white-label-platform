-- Plano operacional de homologação. NÃO executar sem revisar explicitamente.
-- Cria somente UM public.plans para Kataluu -> White Label; não cria subscription,
-- invoice, payment, tenant, Auth ou qualquer outro registro.
-- Moeda não pertence ao contrato de public.plans; BRL é persistido nos fatos financeiros.
-- Se o slug já existir, aceita somente o registro exatamente igual; qualquer divergência falha fechado.

do $$
declare
  v_slug constant text := 'hml-white-label';
  v_name constant text := 'Homologação White Label';
  v_price_cents constant integer := 19900;
  v_billing_interval constant text := 'monthly';
  v_existing_name text;
  v_existing_price_cents integer;
  v_existing_active boolean;
  v_existing_billing_interval text;
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

  select name,price_cents,active,billing_interval
  into v_existing_name,v_existing_price_cents,v_existing_active,v_existing_billing_interval
  from public.plans
  where slug = v_slug;

  if found then
    if v_existing_name is distinct from v_name
      or v_existing_price_cents is distinct from v_price_cents
      or v_existing_active is distinct from true
      or v_existing_billing_interval is distinct from v_billing_interval then
      raise exception 'public.plans slug % existe com configuração divergente; não sobrescrever automaticamente', v_slug;
    end if;
  else
    insert into public.plans(slug,name,price_cents,active,billing_interval)
    values (v_slug,v_name,v_price_cents,true,v_billing_interval);
  end if;
end $$;
