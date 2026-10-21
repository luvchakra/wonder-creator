-- Careers (owner, 21 Oct 2026): the public /careers pages show open jobs and forward applications to WonderJobs
-- (https://jobs.wonderapps.biz), which stores applications and sends every email. This app stores no applicant data.
-- The one thing it keeps is WonderJobs' career-site key (wjcs_…): in Supabase Vault (encrypted at rest), with only its
-- last four characters beside it. A platform administrator sets or clears it from the app (no redeploy); the server
-- reads it with the service role to call WonderJobs. Browsers never read this table or the secret.

create table public.careers_connection (
  id boolean primary key default true check (id),
  vault_secret_id uuid not null,
  hint text not null check (char_length(hint) between 1 and 8),
  updated_by uuid references public.creators(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.careers_connection enable row level security;
-- No policies: nobody but the service role reads or writes it.
revoke all on public.careers_connection from anon, authenticated;

-- Every save and clear is evidence: who, when, and the last four characters only (the `admin.` namespace is reserved
-- for the server, see migration …068).
create or replace function app.careers_audit(p_creator uuid, p_action text, p_hint text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.audit_logs(tenant_id, actor_user_id, actor_creator_id, action, object_type, object_id, metadata)
  select c.tenant_id, c.user_id, c.id, p_action, 'careers_connection', null, jsonb_build_object('last4', p_hint)
  from public.creators c where c.id = p_creator
$$;
revoke execute on function app.careers_audit(uuid, text, text) from public, anon, authenticated;

-- Save (or replace) the key. The server has checked the caller is a platform administrator and the key's shape.
create or replace function public.careers_key_store(p_creator uuid, p_secret text, p_hint text)
returns table (hint text, updated_at timestamptz) language plpgsql security definer set search_path = ''
as $$
declare v_existing uuid; v_id uuid;
begin
  if p_secret is null or p_secret !~ '^wjcs_[A-Za-z0-9_-]{8,200}$' then raise exception 'invalid key' using errcode = '22023'; end if;
  select c.vault_secret_id into v_existing from public.careers_connection c where c.id for update;
  if v_existing is not null then
    perform vault.update_secret(v_existing, p_secret);
    update public.careers_connection c set hint = p_hint, updated_by = p_creator, updated_at = now() where c.id;
  else
    v_id := vault.create_secret(p_secret, 'careers:wonderjobs', 'WonderJobs career-site key');
    insert into public.careers_connection(id, vault_secret_id, hint, updated_by) values (true, v_id, p_hint, p_creator);
  end if;
  perform app.careers_audit(p_creator, 'admin.careers_key_saved', p_hint);
  return query select c.hint, c.updated_at from public.careers_connection c where c.id;
end $$;
revoke execute on function public.careers_key_store(uuid, text, text) from public, anon, authenticated;
grant execute on function public.careers_key_store(uuid, text, text) to service_role;

-- The secret itself, for the server's calls to WonderJobs.
create or replace function public.careers_key_secret()
returns text language sql stable security definer set search_path = ''
as $$
  select s.decrypted_secret from public.careers_connection c join vault.decrypted_secrets s on s.id = c.vault_secret_id where c.id
$$;
revoke execute on function public.careers_key_secret() from public, anon, authenticated;
grant execute on function public.careers_key_secret() to service_role;

-- Clear the key (the secret goes with it).
create or replace function public.careers_key_clear(p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v uuid; v_hint text;
begin
  delete from public.careers_connection c where c.id returning c.vault_secret_id, c.hint into v, v_hint;
  if v is null then return; end if;
  delete from vault.secrets where id = v;
  perform app.careers_audit(p_creator, 'admin.careers_key_cleared', v_hint);
end $$;
revoke execute on function public.careers_key_clear(uuid) from public, anon, authenticated;
grant execute on function public.careers_key_clear(uuid) to service_role;
