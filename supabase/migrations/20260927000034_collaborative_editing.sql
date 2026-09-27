-- P1-06 Collaborative Artifact Editing.
-- - Collaborators are a piece's contributors with an access level: comment, propose (suggest changes the owner
--   accepts or declines) or edit (save new versions directly). Existing contributor rows keep comment access.
-- - Every change stays a new, immutable version attributed to the person who wrote it (created_by_creator_id),
--   never flattened into the owner's or into "AI". Accepting a proposal credits its proposer.
-- - Conflict-safe: a proposal and a direct edit are based on a specific version. A direct edit on a stale base is
--   refused; accepting a proposal whose base is no longer current needs the owner's explicit confirmation.
-- - Comments (optionally on a version and a quoted passage) are visible to the owner and collaborators only.

alter table public.artifact_contributors
  add column access text not null default 'comment' check (access in ('comment', 'propose', 'edit'));

-- owner | edit | propose | comment | null
create or replace function app.artifact_access(p_artifact uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when app.owns_artifact(p_artifact) then 'owner'
    else (select c.access from public.artifact_contributors c where c.artifact_id = p_artifact and c.contributor_creator_id = app.current_creator_id())
  end
$$;
revoke execute on function app.artifact_access(uuid) from public, anon;
grant execute on function app.artifact_access(uuid) to authenticated;

create or replace function public.artifact_access_of(p_artifact uuid)
returns text language sql stable security definer set search_path = ''
as $$ select app.artifact_access(p_artifact) $$;
revoke execute on function public.artifact_access_of(uuid) from public, anon;
grant execute on function public.artifact_access_of(uuid) to authenticated;

-- Whether the caller can bring someone in (they can see them, and neither has blocked the other).
create or replace function public.creator_reachable(p_creator uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_view_creator(p_creator) and not app.blocked_between(app.current_creator_id(), p_creator) $$;
revoke execute on function public.creator_reachable(uuid) from public, anon;
grant execute on function public.creator_reachable(uuid) to authenticated;

-- A collaborator can leave a piece.
drop policy contributors_write_delete on public.artifact_contributors;
create policy contributors_write_delete on public.artifact_contributors for delete to authenticated
  using (app.owns_artifact(artifact_id) or contributor_creator_id = app.current_creator_id());

create or replace function app.audit_contributor()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit('artifact.collaborator_added', 'artifact', new.artifact_id, jsonb_build_object('collaborator', new.contributor_creator_id, 'role', new.role, 'access', new.access), null);
  elsif tg_op = 'DELETE' then
    perform app.record_audit('artifact.collaborator_removed', 'artifact', old.artifact_id, jsonb_build_object('collaborator', old.contributor_creator_id), null);
    return old;
  elsif new.access is distinct from old.access or new.role is distinct from old.role then
    perform app.record_audit('artifact.collaborator_changed', 'artifact', new.artifact_id, jsonb_build_object('collaborator', new.contributor_creator_id, 'role', new.role, 'access', new.access), null);
  end if;
  return new;
end $$;
create trigger artifact_contributors_audit after insert or update or delete on public.artifact_contributors
  for each row execute function app.audit_contributor();
revoke execute on function app.audit_contributor() from public, anon, authenticated;

-- Comments ---------------------------------------------------------------------------------------------------------
create table public.artifact_comments (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_id uuid references public.artifact_versions(id) on delete set null,
  creator_id uuid references public.creators(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  quote text check (quote is null or char_length(quote) <= 500),
  resolved_at timestamptz,
  resolved_by uuid references public.creators(id) on delete set null,
  created_at timestamptz not null default now()
);
create index artifact_comments_artifact_idx on public.artifact_comments(artifact_id, created_at);
create index artifact_comments_version_id_fk_idx on public.artifact_comments(version_id);
create index artifact_comments_creator_id_fk_idx on public.artifact_comments(creator_id);
create index artifact_comments_resolved_by_fk_idx on public.artifact_comments(resolved_by);
alter table public.artifact_comments enable row level security;
create policy artifact_comments_read on public.artifact_comments for select to authenticated
  using (app.artifact_access(artifact_id) is not null);
create policy artifact_comments_insert on public.artifact_comments for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.artifact_access(artifact_id) is not null and resolved_at is null
              and (version_id is null or exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = artifact_comments.artifact_id)));
-- Resolving: the owner or the comment's author.
create policy artifact_comments_update on public.artifact_comments for update to authenticated
  using (app.artifact_access(artifact_id) = 'owner' or creator_id = app.current_creator_id())
  with check (app.artifact_access(artifact_id) = 'owner' or creator_id = app.current_creator_id());
revoke update on public.artifact_comments from authenticated;
grant update (resolved_at, resolved_by) on public.artifact_comments to authenticated;
create policy artifact_comments_delete on public.artifact_comments for delete to authenticated
  using (creator_id = app.current_creator_id() or app.artifact_access(artifact_id) = 'owner');

-- Proposed changes ---------------------------------------------------------------------------------------------------
create table public.artifact_change_proposals (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  creator_id uuid references public.creators(id) on delete set null,
  base_version_id uuid not null references public.artifact_versions(id) on delete cascade,
  content text not null check (char_length(content) <= 500000),
  summary text not null check (char_length(summary) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'withdrawn')),
  decided_by uuid references public.creators(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  resulting_version_id uuid references public.artifact_versions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index artifact_change_proposals_artifact_idx on public.artifact_change_proposals(artifact_id, status, created_at desc);
create index artifact_change_proposals_creator_id_fk_idx on public.artifact_change_proposals(creator_id);
create index artifact_change_proposals_base_version_id_fk_idx on public.artifact_change_proposals(base_version_id);
create index artifact_change_proposals_decided_by_fk_idx on public.artifact_change_proposals(decided_by);
create index artifact_change_proposals_resulting_version_id_fk_idx on public.artifact_change_proposals(resulting_version_id);
alter table public.artifact_change_proposals enable row level security;
create policy artifact_proposals_read on public.artifact_change_proposals for select to authenticated
  using (app.artifact_access(artifact_id) is not null);
-- Proposals are made on the current version by collaborators who can propose or edit.
create policy artifact_proposals_insert on public.artifact_change_proposals for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and status = 'open' and decided_by is null and resulting_version_id is null
    and app.artifact_access(artifact_id) in ('propose', 'edit')
    and exists (select 1 from public.artifacts a where a.id = artifact_id and a.current_version_id = base_version_id and a.status <> 'archived')
  );
-- Decisions go through the functions below.
revoke update, delete on public.artifact_change_proposals from authenticated;

-- Create a version attributed to a person (not the caller necessarily). Internal: callers authorize first.
create or replace function app.add_attributed_version(p_artifact uuid, p_author uuid, p_content text, p_label text, p_summary text)
returns public.artifact_versions language plpgsql security definer set search_path = ''
as $$
declare a public.artifacts; v_next int; v public.artifact_versions;
begin
  select * into a from public.artifacts where id = p_artifact for update;
  if a.status = 'archived' then raise exception 'artifact is archived' using errcode = '22023'; end if;
  select coalesce(max(version_number), 0) + 1 into v_next from public.artifact_versions where artifact_id = p_artifact;
  insert into public.artifact_versions(artifact_id, creator_id, version_number, parent_version_id, label, content, change_summary, author_kind, created_by_creator_id)
  values (p_artifact, a.creator_id, v_next, a.current_version_id, coalesce(nullif(p_label, ''), 'Revised'), coalesce(p_content, ''), p_summary, 'creator', p_author)
  returning * into v;
  update public.artifacts set current_version_id = v.id where id = p_artifact;
  perform app.record_event('ArtifactVersionCreated', 'artifact', p_artifact,
    jsonb_build_object('versionId', v.id, 'versionNumber', v_next, 'authorKind', 'creator', 'authorId', p_author));
  return v;
end $$;
revoke execute on function app.add_attributed_version(uuid, uuid, text, text, text) from public, anon, authenticated;

-- The owner accepts a proposal. If the piece moved on since it was proposed, p_confirm_stale must be true.
create or replace function public.accept_artifact_proposal(p_proposal uuid, p_confirm_stale boolean default false)
returns public.artifact_versions language plpgsql security definer set search_path = ''
as $$
declare p public.artifact_change_proposals; a public.artifacts; v public.artifact_versions; who text;
begin
  select * into p from public.artifact_change_proposals where id = p_proposal for update;
  if p.id is null or app.artifact_access(p.artifact_id) is distinct from 'owner' then raise exception 'proposal not found' using errcode = 'P0002'; end if;
  if p.status <> 'open' then raise exception 'already decided' using errcode = '55000'; end if;
  select * into a from public.artifacts where id = p.artifact_id;
  if a.current_version_id <> p.base_version_id and not p_confirm_stale then
    raise exception 'stale proposal' using errcode = '40001';
  end if;
  select display_name into who from public.creators where id = p.creator_id;
  v := app.add_attributed_version(p.artifact_id, p.creator_id, p.content, 'Accepted change', left('Proposed by ' || coalesce(who, 'a collaborator') || ': ' || p.summary, 500));
  update public.artifact_change_proposals set status = 'accepted', decided_by = app.current_creator_id(), decided_at = now(), resulting_version_id = v.id where id = p.id;
  perform app.record_audit('artifact.proposal_accepted', 'artifact', p.artifact_id, jsonb_build_object('proposal', p.id, 'version', v.version_number, 'proposer', p.creator_id, 'stale', a.current_version_id <> p.base_version_id), null);
  return v;
end $$;

create or replace function public.decline_artifact_proposal(p_proposal uuid, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare p public.artifact_change_proposals;
begin
  select * into p from public.artifact_change_proposals where id = p_proposal for update;
  if p.id is null or app.artifact_access(p.artifact_id) is distinct from 'owner' then raise exception 'proposal not found' using errcode = 'P0002'; end if;
  if p.status <> 'open' then raise exception 'already decided' using errcode = '55000'; end if;
  update public.artifact_change_proposals set status = 'declined', decided_by = app.current_creator_id(), decided_at = now(), decision_note = nullif(trim(p_note), '') where id = p.id;
  perform app.record_audit('artifact.proposal_declined', 'artifact', p.artifact_id, jsonb_build_object('proposal', p.id, 'proposer', p.creator_id), null);
end $$;

create or replace function public.withdraw_artifact_proposal(p_proposal uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.artifact_change_proposals set status = 'withdrawn', decided_at = now()
  where id = p_proposal and creator_id = app.current_creator_id() and status = 'open';
  if not found then raise exception 'proposal not found' using errcode = 'P0002'; end if;
end $$;

-- A collaborator with edit access saves a new version directly, based on the current one (stale saves refused).
create or replace function public.collaborator_save_version(p_artifact uuid, p_base_version uuid, p_content text, p_summary text default null)
returns public.artifact_versions language plpgsql security definer set search_path = ''
as $$
declare a public.artifacts; v public.artifact_versions;
begin
  if app.artifact_access(p_artifact) is distinct from 'edit' then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into a from public.artifacts where id = p_artifact for update;
  if a.current_version_id is distinct from p_base_version then raise exception 'stale edit' using errcode = '40001'; end if;
  if p_content is null or char_length(p_content) > 500000 then raise exception 'invalid content' using errcode = '22023'; end if;
  if exists (select 1 from public.artifact_versions x where x.id = a.current_version_id and x.content = p_content) then raise exception 'no changes' using errcode = '22023'; end if;
  v := app.add_attributed_version(p_artifact, app.current_creator_id(), p_content, 'Edited by collaborator', left(coalesce(nullif(trim(p_summary), ''), 'Edited in Studio.'), 500));
  perform app.record_audit('artifact.collaborator_edit', 'artifact', p_artifact, jsonb_build_object('version', v.version_number), null);
  return v;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.accept_artifact_proposal(uuid, boolean)', 'public.decline_artifact_proposal(uuid, text)',
    'public.withdraw_artifact_proposal(uuid)', 'public.collaborator_save_version(uuid, uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
