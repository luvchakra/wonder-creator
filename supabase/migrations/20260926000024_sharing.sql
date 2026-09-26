-- P0.1-09 Artifact share / download / export.
-- A piece can be shared without publishing it: as a private link (anyone holding it, optionally embeddable)
-- or with a named creator. Shares can pin a version or follow the current one, can expire, and can be
-- revoked. Shared content is served only through the security-definer functions below, which return the
-- piece's title and text and nothing else: no source material, lineage, contributors or rights details.
-- Link tokens are stored as SHA-256 hashes; the token itself is shown to the owner once.

create table public.artifact_shares (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('link', 'creator')),
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  recipient_creator_id uuid references public.creators(id) on delete cascade,
  version_id uuid references public.artifact_versions(id) on delete cascade,
  allow_download boolean not null default false,
  allow_embed boolean not null default false,
  label text check (label is null or char_length(label) between 1 and 80),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'link' and token_hash is not null and recipient_creator_id is null)
    or (kind = 'creator' and token_hash is null and recipient_creator_id is not null and not allow_embed)
  ),
  check (recipient_creator_id is null or recipient_creator_id <> creator_id)
);
create index artifact_shares_artifact_idx on public.artifact_shares(artifact_id, created_at desc);
create index artifact_shares_recipient_idx on public.artifact_shares(recipient_creator_id, created_at desc) where recipient_creator_id is not null;
create index artifact_shares_creator_id_fk_idx on public.artifact_shares(creator_id);
create index artifact_shares_version_id_fk_idx on public.artifact_shares(version_id);
-- One live share per person per piece.
create unique index artifact_shares_one_live on public.artifact_shares(artifact_id, recipient_creator_id) where recipient_creator_id is not null and revoked_at is null;

alter table public.artifact_shares enable row level security;
create policy artifact_shares_read on public.artifact_shares for select to authenticated
  using (creator_id = app.current_creator_id() or recipient_creator_id = app.current_creator_id());
create policy artifact_shares_insert on public.artifact_shares for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and app.owns_artifact(artifact_id)
    and revoked_at is null and last_accessed_at is null
    and (expires_at is null or expires_at > now())
    and (version_id is null or exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = artifact_shares.artifact_id))
    and (recipient_creator_id is null or not exists (
      select 1 from public.creator_blocks b
      where (b.blocker_creator_id = app.current_creator_id() and b.blocked_creator_id = recipient_creator_id)
         or (b.blocker_creator_id = recipient_creator_id and b.blocked_creator_id = app.current_creator_id())
    ))
  );
-- No update/delete policies: revoking goes through revoke_artifact_share().

-- A share is live when it isn't revoked or expired and its piece isn't archived.
create or replace function app.share_payload(s public.artifact_shares)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare a public.artifacts; v public.artifact_versions; c public.creators;
begin
  select * into a from public.artifacts where id = s.artifact_id;
  if a.id is null or a.status = 'archived' then return null; end if;
  select * into v from public.artifact_versions where id = coalesce(s.version_id, a.current_version_id);
  select * into c from public.creators where id = s.creator_id;
  return jsonb_build_object(
    'shareId', s.id, 'kind', s.kind, 'artifactId', a.id, 'title', a.title, 'artifactType', a.artifact_type, 'category', a.category,
    'versionNumber', v.version_number, 'versionCreatedAt', v.created_at, 'pinned', s.version_id is not null, 'content', coalesce(v.content, ''),
    'creatorName', c.display_name, 'creatorHandle', c.handle,
    'allowDownload', s.allow_download, 'allowEmbed', s.allow_embed, 'expiresAt', s.expires_at, 'sharedAt', s.created_at
  );
end $$;
revoke execute on function app.share_payload(public.artifact_shares) from public, anon, authenticated;

-- Open a private link (signed-out viewers included). Unknown, revoked and expired links look the same.
create or replace function public.open_share_link(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare s public.artifact_shares; payload jsonb;
begin
  if p_token is null or char_length(p_token) not between 20 and 100 then return null; end if;
  select * into s from public.artifact_shares
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and kind = 'link'
    and revoked_at is null and (expires_at is null or expires_at > now());
  if s.id is null then return null; end if;
  payload := app.share_payload(s);
  if payload is not null then
    update public.artifact_shares set last_accessed_at = now() where id = s.id and (last_accessed_at is null or last_accessed_at < now() - interval '1 minute');
  end if;
  return payload;
end $$;
revoke execute on function public.open_share_link(text) from public;
grant execute on function public.open_share_link(text) to anon, authenticated;

-- Open something shared with me by name.
create or replace function public.open_creator_share(p_share uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare s public.artifact_shares; payload jsonb;
begin
  select * into s from public.artifact_shares
  where id = p_share and kind = 'creator' and recipient_creator_id = app.current_creator_id()
    and revoked_at is null and (expires_at is null or expires_at > now());
  if s.id is null then return null; end if;
  payload := app.share_payload(s);
  if payload is not null then
    update public.artifact_shares set last_accessed_at = now() where id = s.id and (last_accessed_at is null or last_accessed_at < now() - interval '1 minute');
  end if;
  return payload;
end $$;
revoke execute on function public.open_creator_share(uuid) from public, anon;
grant execute on function public.open_creator_share(uuid) to authenticated;

-- What's been shared with me (live shares only), with just enough to list them.
create or replace function public.shared_with_me()
returns table (share_id uuid, title text, artifact_type text, creator_name text, shared_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, a.title, a.artifact_type, c.display_name, s.created_at, s.expires_at
  from public.artifact_shares s
  join public.artifacts a on a.id = s.artifact_id and a.status <> 'archived'
  join public.creators c on c.id = s.creator_id
  where s.kind = 'creator' and s.recipient_creator_id = app.current_creator_id()
    and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
  order by s.created_at desc
  limit 100
$$;
revoke execute on function public.shared_with_me() from public, anon;
grant execute on function public.shared_with_me() to authenticated;

-- Revoke: owner only; a revoked share stops working immediately and can't be revived.
create or replace function public.revoke_artifact_share(p_share uuid)
returns public.artifact_shares language plpgsql security definer set search_path = ''
as $$
declare s public.artifact_shares;
begin
  update public.artifact_shares set revoked_at = now()
  where id = p_share and creator_id = app.current_creator_id() and revoked_at is null
  returning * into s;
  if s.id is null then
    if exists (select 1 from public.artifact_shares where id = p_share and creator_id = app.current_creator_id()) then
      raise exception 'This share was already turned off.' using errcode = '55000';
    end if;
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return s;
end $$;
revoke execute on function public.revoke_artifact_share(uuid) from public, anon;
grant execute on function public.revoke_artifact_share(uuid) to authenticated;

-- Audit: shares made and revoked.
create or replace function app.audit_share()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit('share.created', 'artifact', new.artifact_id,
      jsonb_build_object('share_id', new.id, 'kind', new.kind, 'recipient', new.recipient_creator_id, 'expires_at', new.expires_at,
                         'allow_download', new.allow_download, 'allow_embed', new.allow_embed, 'pinned_version', new.version_id), null);
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform app.record_audit('share.revoked', 'artifact', new.artifact_id, jsonb_build_object('share_id', new.id, 'kind', new.kind), null);
  end if;
  return new;
end $$;
create trigger artifact_shares_audit after insert or update of revoked_at on public.artifact_shares
  for each row execute function app.audit_share();
revoke execute on function app.audit_share() from public, anon, authenticated;
