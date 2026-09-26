-- Handle availability without exposing whether a private creator exists beyond a boolean.
create or replace function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_handle ~ '^[a-z0-9_]{3,30}$'
     and lower(p_handle) not in ('admin', 'support', 'wonder', 'wondercreator', 'creatorbrain', 'settings', 'api', 'huddles', 'create', 'space', 'profile', 'help', 'about')
     and not exists (select 1 from public.creators c where lower(c.handle::text) = lower(p_handle))
$$;
revoke execute on function public.handle_available(text) from anon, public;
grant execute on function public.handle_available(text) to authenticated;
