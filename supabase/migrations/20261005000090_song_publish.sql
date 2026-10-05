-- Completion, part two (docs/creative-room-parts.md, step 5b): publishing the song together. The song becomes a Creation
-- of its own — the Room owner's, made of the mix as heard and the words — and it may be published only while the Room's
-- credits are agreed and still hold. That is enforced where a publication is written, so no path around it exists.

create table public.project_songs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  artifact_id uuid not null unique references public.artifacts(id) on delete cascade,
  created_by uuid references public.creators(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.project_songs enable row level security;
create policy project_songs_read on public.project_songs for select to authenticated using (app.can_see_project(project_id));
revoke insert, update, delete on public.project_songs from anon, authenticated;

-- A Room's song whose credits aren't agreed, or no longer hold, can't be published.
create or replace function app.song_blocks_publish(p_artifact uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_songs s
    where s.artifact_id = p_artifact
      and not exists (
        select 1 from public.project_song_agreements g
        where g.project_id = s.project_id and g.status = 'agreed' and app.song_agreement_holds(g.id)
      )
  )
$$;
revoke execute on function app.song_blocks_publish(uuid) from public, anon;
grant execute on function app.song_blocks_publish(uuid) to authenticated;

drop policy published_revisions_insert on public.published_revisions;
create policy published_revisions_insert on public.published_revisions for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and app.owns_artifact(artifact_id)
    and exists (select 1 from public.published_works w where w.id = work_id and w.artifact_id = published_revisions.artifact_id and w.creator_id = app.current_creator_id())
    and (version_id is null or exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = published_revisions.artifact_id))
    and not app.song_blocks_publish(artifact_id)
  );

-- Make a Creation the Room's song: the Room's owner, their own Creation, and only once the credits are agreed and hold.
create or replace function public.song_attach(p_project uuid, p_artifact uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_existing uuid;
begin
  if not exists (select 1 from public.projects where id = p_project and creator_id = v_me) then
    raise exception 'only the Room''s owner publishes its song' using errcode = '42501';
  end if;
  if not exists (select 1 from public.artifacts where id = p_artifact and creator_id = v_me) then
    raise exception 'the song must be your own Creation' using errcode = '42501';
  end if;
  if not exists (select 1 from public.project_song_agreements g where g.project_id = p_project and g.status = 'agreed' and app.song_agreement_holds(g.id)) then
    raise exception 'the credits must be agreed by everyone first' using errcode = '22023';
  end if;
  if exists (select 1 from public.project_parts where artifact_id = p_artifact) then
    raise exception 'a part can''t be the song' using errcode = '22023';
  end if;
  select artifact_id into v_existing from public.project_songs where project_id = p_project;
  if v_existing is not null and v_existing <> p_artifact then raise exception 'this Room''s song is already a Creation' using errcode = '23505'; end if;
  insert into public.project_songs(project_id, artifact_id, created_by) values (p_project, p_artifact, v_me)
  on conflict (project_id) do nothing;
  perform app.record_audit('song.attached', 'project', p_project, jsonb_build_object('artifactId', p_artifact), null);
end $$;
revoke execute on function public.song_attach(uuid, uuid) from public, anon;
grant execute on function public.song_attach(uuid, uuid) to authenticated;
