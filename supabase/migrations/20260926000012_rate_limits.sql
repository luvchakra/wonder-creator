-- Shared fixed-window rate limiting across server instances.
-- Counters are disposable (UNLOGGED: lost on crash, which only resets windows early).
-- Only the server (service_role) may count: callers never choose whose limit they spend.

create unlogged table public.rate_limit_counters (
  key text not null check (char_length(key) between 1 and 300),
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
create index rate_limit_counters_window_idx on public.rate_limit_counters(window_start);
alter table public.rate_limit_counters enable row level security;
-- No policies: not readable or writable through the API by anon/authenticated.

/** Count one hit for p_key in the current window; true while within p_limit. */
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_counters as c (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = c.count + 1
  returning c.count into v_count;
  -- Opportunistic cleanup keeps the table small without a separate job.
  if random() < 0.01 then
    delete from public.rate_limit_counters where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_limit;
end $$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
