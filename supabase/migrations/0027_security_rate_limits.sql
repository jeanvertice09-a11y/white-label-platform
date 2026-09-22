-- 0027_security_rate_limits.sql
-- Rate limiting persistente e atômico para superfícies controladas pela aplicação.
-- As chaves são construídas server-side a partir de recursos já resolvidos.

create table if not exists public.security_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now(),
  constraint security_rate_limits_key_length check (char_length(rate_key) between 3 and 200)
);

alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_security_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hits integer;
begin
  if p_key is null or char_length(p_key) not between 3 and 200
     or p_limit not between 1 and 10000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.security_rate_limits as rl(rate_key,window_started_at,hits,updated_at)
  values (p_key,now(),1,now())
  on conflict (rate_key) do update set
    window_started_at = case
      when rl.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else rl.window_started_at
    end,
    hits = case
      when rl.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else rl.hits + 1
    end,
    updated_at = now()
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_security_rate_limit(text,integer,integer) from public, anon, authenticated;
