-- Google sign-in (owner, 2 Oct 2026): an account created through Google carries the person's name as `full_name` /
-- `name`, not `display_name`. Take it from whichever is present, so the creator isn't named after their email.
create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_name text := btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''));
begin
  insert into public.tenants(name, kind) values (coalesce(nullif(v_name, ''), 'Creator'), 'personal') returning id into v_tenant;
  insert into public.tenant_memberships(tenant_id, user_id, role) values (v_tenant, new.id, 'owner');
  insert into public.creators(user_id, tenant_id, display_name) values (new.id, v_tenant, left(v_name, 80));
  return new;
end $$;
