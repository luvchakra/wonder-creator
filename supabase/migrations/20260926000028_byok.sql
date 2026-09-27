-- P0.1-16 AI provider & BYOK.
-- A creator can connect their own AI provider key. The secret lives in Supabase Vault (encrypted at rest);
-- the creator's rows hold only a hint (last 4 characters), the validation status, the models the key can use
-- and their preferences. Every function that stores, reads or removes a secret is callable by the server's
-- service role only (after the API has authenticated the creator and validated the key), never by browsers.
-- Lifecycle events are audited without the secret.

create table public.creator_ai_keys (
  creator_id uuid not null references public.creators(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'anthropic')),
  vault_secret_id uuid not null,
  hint text not null check (char_length(hint) between 1 and 8),
  status text not null check (status in ('valid', 'unverified', 'invalid')),
  models text[] not null default '{}' check (cardinality(models) <= 200),
  default_model text check (default_model is null or char_length(default_model) <= 120),
  use_for_brain boolean not null default true,
  validated_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  primary key (creator_id, provider)
);
alter table public.creator_ai_keys enable row level security;
-- Creators see their own key records (never the secret, which isn't in this table).
create policy creator_ai_keys_read on public.creator_ai_keys for select to authenticated using (creator_id = app.current_creator_id());
-- No write policies: all changes go through the service-role functions below.
revoke insert, update, delete on public.creator_ai_keys from anon, authenticated;

create or replace function app.byok_audit(p_creator uuid, p_action text, p_provider text, p_extra jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = ''
as $$
  insert into public.audit_logs(tenant_id, actor_user_id, actor_creator_id, action, object_type, object_id, metadata)
  select c.tenant_id, c.user_id, c.id, p_action, 'ai_provider', null, jsonb_build_object('provider', p_provider) || coalesce(p_extra, '{}'::jsonb)
  from public.creators c where c.id = p_creator
$$;
revoke execute on function app.byok_audit(uuid, text, text, jsonb) from public, anon, authenticated;

-- Store (connect or rotate) a key that the server has already validated.
create or replace function public.byok_store(p_creator uuid, p_provider text, p_secret text, p_hint text, p_status text, p_models text[])
returns public.creator_ai_keys language plpgsql security definer set search_path = ''
as $$
declare existing public.creator_ai_keys; v_id uuid; r public.creator_ai_keys;
begin
  if p_secret is null or char_length(p_secret) not between 10 and 500 then raise exception 'invalid secret' using errcode = '22023'; end if;
  select * into existing from public.creator_ai_keys where creator_id = p_creator and provider = p_provider for update;
  if existing.creator_id is not null then
    perform vault.update_secret(existing.vault_secret_id, p_secret);
    update public.creator_ai_keys set hint = p_hint, status = p_status, models = coalesce(p_models, '{}'), validated_at = case when p_status = 'unverified' then null else now() end,
      last_error = null, rotated_at = now(),
      default_model = case when default_model = any(coalesce(p_models, '{}')) then default_model end
    where creator_id = p_creator and provider = p_provider returning * into r;
    perform app.byok_audit(p_creator, 'ai_key.rotated', p_provider, jsonb_build_object('status', p_status));
  else
    v_id := vault.create_secret(p_secret, 'byok:' || p_creator || ':' || p_provider, 'Creator AI key (BYOK)');
    insert into public.creator_ai_keys(creator_id, provider, vault_secret_id, hint, status, models, validated_at)
    values (p_creator, p_provider, v_id, p_hint, p_status, coalesce(p_models, '{}'), case when p_status = 'unverified' then null else now() end)
    returning * into r;
    perform app.byok_audit(p_creator, 'ai_key.connected', p_provider, jsonb_build_object('status', p_status));
  end if;
  return r;
end $$;
revoke execute on function public.byok_store(uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.byok_store(uuid, text, text, text, text, text[]) to service_role;

-- Read a secret to call the provider on the creator's behalf (server only).
create or replace function public.byok_secret(p_creator uuid, p_provider text)
returns text language sql stable security definer set search_path = ''
as $$
  select s.decrypted_secret from public.creator_ai_keys k join vault.decrypted_secrets s on s.id = k.vault_secret_id
  where k.creator_id = p_creator and k.provider = p_provider
$$;
revoke execute on function public.byok_secret(uuid, text) from public, anon, authenticated;
grant execute on function public.byok_secret(uuid, text) to service_role;

-- Record a re-validation or a provider failure, and the creator's preferences.
create or replace function public.byok_update(p_creator uuid, p_provider text, p_status text default null, p_models text[] default null, p_error text default null,
                                              p_default_model text default null, p_use_for_brain boolean default null, p_clear_default boolean default false)
returns public.creator_ai_keys language plpgsql security definer set search_path = ''
as $$
declare r public.creator_ai_keys;
begin
  update public.creator_ai_keys set
    status = coalesce(p_status, status),
    models = coalesce(p_models, models),
    validated_at = case when p_status in ('valid', 'invalid') then now() else validated_at end,
    last_error = case when p_status is not null or p_error is not null then left(p_error, 300) else last_error end,
    default_model = case when p_clear_default then null when p_default_model is not null then p_default_model else default_model end,
    use_for_brain = coalesce(p_use_for_brain, use_for_brain)
  where creator_id = p_creator and provider = p_provider returning * into r;
  if r.creator_id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_default_model is not null and not (p_default_model = any(r.models)) then raise exception 'unknown model' using errcode = '22023'; end if;
  if p_status is not null then perform app.byok_audit(p_creator, 'ai_key.validated', p_provider, jsonb_build_object('status', p_status)); end if;
  if p_default_model is not null or p_use_for_brain is not null or p_clear_default then
    perform app.byok_audit(p_creator, 'ai_key.preferences', p_provider, jsonb_build_object('default_model', r.default_model, 'use_for_brain', r.use_for_brain));
  end if;
  return r;
end $$;
revoke execute on function public.byok_update(uuid, text, text, text[], text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.byok_update(uuid, text, text, text[], text, text, boolean, boolean) to service_role;

-- Remove: the secret is deleted from Vault, not just hidden.
create or replace function public.byok_remove(p_creator uuid, p_provider text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v uuid;
begin
  delete from public.creator_ai_keys where creator_id = p_creator and provider = p_provider returning vault_secret_id into v;
  if v is null then raise exception 'not found' using errcode = 'P0002'; end if;
  delete from vault.secrets where id = v;
  perform app.byok_audit(p_creator, 'ai_key.removed', p_provider);
end $$;
revoke execute on function public.byok_remove(uuid, text) from public, anon, authenticated;
grant execute on function public.byok_remove(uuid, text) to service_role;

-- When a creator's account goes, their secrets go too.
create or replace function app.byok_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end $$;
create trigger creator_ai_keys_cleanup after delete on public.creator_ai_keys
  for each row execute function app.byok_cleanup();
revoke execute on function app.byok_cleanup() from public, anon, authenticated;
