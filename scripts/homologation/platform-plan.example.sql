-- Template operacional. NÃO executar sem preencher e revisar explicitamente.
-- Cria somente UM public.plans para Kataluu -> White Label; não cria subscription,
-- invoice, payment, tenant, Auth ou qualquer outro registro.

do $$
declare
  v_slug text := null;              -- exemplo: 'hml-kataluu-explicito'
  v_name text := null;              -- exemplo: 'Plano Kataluu HML'
  v_price_cents integer := null;    -- decisão comercial explícita do operador
  v_currency text := 'BRL';
  v_billing_interval text := null;  -- 'monthly' ou 'yearly'
begin
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'preencha v_slug com slug válido antes de executar';
  end if;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'preencha v_name antes de executar';
  end if;
  if v_price_cents is null or v_price_cents < 0 then
    raise exception 'preencha v_price_cents explicitamente antes de executar';
  end if;
  if v_billing_interval not in ('monthly','yearly') then
    raise exception 'preencha v_billing_interval com monthly ou yearly';
  end if;
  if exists (select 1 from public.plans where slug = v_slug) then
    raise exception 'public.plans já contém o slug %; não sobrescrever automaticamente', v_slug;
  end if;

  insert into public.plans(slug,name,price_cents,currency,active,billing_interval)
  values (v_slug,v_name,v_price_cents,v_currency,true,v_billing_interval);
end $$;
