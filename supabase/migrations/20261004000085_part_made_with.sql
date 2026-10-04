-- Made with (docs/creative-room-parts.md, step 2). Lyrics and tune work on each other, so every version of a part's
-- Creation records which versions of the other parts it was made with — "the lyrics moved on since this take" is then
-- a comparison, never a guess. The people making the work read each part's versions, and anyone on a part may
-- suggest a change to another part: a proposal its people accept or decline, as collaborators' proposals already are.

create table public.project_part_version_context (
  version_id uuid primary key references public.artifact_versions(id) on delete cascade,
  part_id uuid not null references public.project_parts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  -- [{partId, title, artifactId, versionId, versionNumber}] for every other part, in order; null version = not started.
  made_with jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index project_part_version_context_part_idx on public.project_part_version_context(part_id, created_at desc);
create index project_part_version_context_project_idx on public.project_part_version_context(project_id);
create trigger project_part_version_context_immutable before update on public.project_part_version_context
  for each row execute function app.prevent_mutation();

alter table public.project_part_version_context enable row level security;
create policy project_part_version_context_read on public.project_part_version_context for select to authenticated
  using (app.can_see_project(project_id));
revoke insert, update, delete on public.project_part_version_context from anon, authenticated;

-- Recorded as the version lands, whichever way it was made (the Writing page, a take, a picture set, a restore).
-- The new version's own Creation isn't current yet at this point, so only the other parts are read.
create or replace function app.record_made_with()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_part uuid; v_project uuid;
begin
  select id, project_id into v_part, v_project from public.project_parts where artifact_id = new.artifact_id;
  if v_part is null then return new; end if;
  insert into public.project_part_version_context(version_id, part_id, project_id, made_with)
  select new.id, v_part, v_project,
    coalesce(jsonb_agg(jsonb_build_object('partId', pp.id, 'title', pp.title, 'artifactId', pp.artifact_id, 'versionId', a.current_version_id, 'versionNumber', v.version_number) order by pp.position, pp.created_at), '[]'::jsonb)
  from public.project_parts pp
  left join public.artifacts a on a.id = pp.artifact_id
  left join public.artifact_versions v on v.id = a.current_version_id
  where pp.project_id = v_project and pp.id <> v_part;
  return new;
end $$;
revoke execute on function app.record_made_with() from public, anon, authenticated;
create trigger artifact_versions_made_with after insert on public.artifact_versions
  for each row execute function app.record_made_with();

-- The people making the work read each part's versions (the words on the Audio page, what changed since this take),
-- as they already read the parts' Creations. Nothing else about who reads a version changed.
drop policy versions_read on public.artifact_versions;
create policy versions_read on public.artifact_versions for select to authenticated
  using (
    creator_id = app.current_creator_id()
    or exists (select 1 from public.artifact_contributors ac where ac.artifact_id = artifact_versions.artifact_id and ac.contributor_creator_id = app.current_creator_id())
    or exists (
      select 1 from public.artifacts a
      where a.id = artifact_versions.artifact_id and a.current_version_id = artifact_versions.id
        and a.privacy = 'public' and a.status in ('final', 'published') and app.can_view_creator(a.creator_id)
    )
    or app.reads_part_artifact(artifact_id)
  );

-- Whoever proposed a change sees what became of it, even without access to the Creation itself (a singer's suggestion
-- to the lyricist).
drop policy artifact_proposals_read on public.artifact_change_proposals;
create policy artifact_proposals_read on public.artifact_change_proposals for select to authenticated
  using (creator_id = app.current_creator_id() or app.artifact_access(artifact_id) is not null);

-- Suggest a change to another part: anyone active on a part of the same Room (or in its crew) proposes new words for
-- a part's Creation, on its current version. The people on that part decide — nothing changes until they accept.
create or replace function public.part_suggest(p_part uuid, p_content text, p_summary text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid := app.part_project(p_part); v_artifact uuid; v_status text; v_current uuid; v_id uuid;
begin
  if v_project is null then raise exception 'part not found' using errcode = 'P0002'; end if;
  if not (app.on_a_part_of(v_project, true) or app.project_role(v_project) is not null) then
    raise exception 'only people making this work can suggest a change' using errcode = '42501';
  end if;
  select artifact_id into v_artifact from public.project_parts where id = p_part;
  if v_artifact is null then raise exception 'this part hasn''t been started' using errcode = '55000'; end if;
  select status, current_version_id into v_status, v_current from public.artifacts where id = v_artifact for update;
  if v_status = 'archived' then raise exception 'artifact is archived' using errcode = '22023'; end if;
  if v_current is null then raise exception 'this part has no words yet' using errcode = '55000'; end if;
  if app.artifact_access(v_artifact) = 'owner' then raise exception 'it''s your own — just write' using errcode = '22023'; end if;
  if char_length(coalesce(p_content, '')) > 500000 then raise exception 'too long' using errcode = '22023'; end if;
  insert into public.artifact_change_proposals(artifact_id, creator_id, base_version_id, content, summary)
  values (v_artifact, v_me, v_current, coalesce(p_content, ''), left(coalesce(nullif(trim(p_summary), ''), 'A suggestion'), 500))
  returning id into v_id;
  perform app.part_log(p_part, 'suggested', null, jsonb_build_object('proposalId', v_id, 'summary', left(coalesce(nullif(trim(p_summary), ''), 'A suggestion'), 500)));
  return v_id;
end $$;
revoke execute on function public.part_suggest(uuid, text, text) from public, anon;
grant execute on function public.part_suggest(uuid, text, text) to authenticated;
