-- Notes on a moment (docs/creative-room-parts.md, step 4b): while listening together, the people making the work leave
-- a note at a moment of the song — "the voice comes in early here" — about the whole song or one part. A note records
-- which version of each part was playing, so a note on an earlier take says so. Notes are read by whoever can see the
-- Room; written only through mix_note_add; resolved by their author or the Room's owner/admins; deleted by their author
-- (or the owner/admins). A note about a part shows in the Room's timeline.

create table public.project_mix_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  part_id uuid references public.project_parts(id) on delete set null,
  creator_id uuid references public.creators(id) on delete set null,
  at_ms integer not null check (at_ms between 0 and 3600000),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  -- [{partId, title, versionNumber}] — the takes as they were when the note was left.
  heard jsonb not null default '[]'::jsonb check (jsonb_typeof(heard) = 'array'),
  resolved_at timestamptz,
  resolved_by uuid references public.creators(id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_mix_notes_project_idx on public.project_mix_notes(project_id, at_ms);

alter table public.project_mix_notes enable row level security;
create policy project_mix_notes_read on public.project_mix_notes for select to authenticated
  using (app.can_see_project(project_id));
create policy project_mix_notes_delete on public.project_mix_notes for delete to authenticated
  using (creator_id = app.current_creator_id() or app.manages_project(project_id));
revoke insert, update on public.project_mix_notes from anon, authenticated;

create or replace function public.mix_note_add(p_project uuid, p_at_ms integer, p_body text, p_part uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_id uuid; v_heard jsonb;
begin
  if not (app.on_a_part_of(p_project, true) or app.project_role(p_project) is not null) then
    raise exception 'only the people making the work leave notes' using errcode = '42501';
  end if;
  if p_part is not null and not exists (select 1 from public.project_parts where id = p_part and project_id = p_project) then
    raise exception 'not a part of this Room' using errcode = '22023';
  end if;
  if p_at_ms is null or p_at_ms < 0 or p_at_ms > 3600000 then raise exception 'a moment within the hour' using errcode = '22023'; end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 1000 then raise exception 'say it in a line or two' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('partId', pp.id, 'title', pp.title, 'versionNumber', v.version_number) order by pp.position, pp.created_at), '[]'::jsonb)
    into v_heard
  from public.project_parts pp
  join public.artifacts a on a.id = pp.artifact_id
  join public.artifact_versions v on v.id = a.current_version_id
  where pp.project_id = p_project and v.structured_content ->> 'kind' = 'audio';
  insert into public.project_mix_notes(project_id, part_id, creator_id, at_ms, body, heard)
  values (p_project, p_part, v_me, p_at_ms, trim(p_body), v_heard)
  returning id into v_id;
  if p_part is not null then
    perform app.part_log(p_part, 'noted', null, jsonb_build_object('noteId', v_id, 'atMs', p_at_ms, 'summary', left(trim(p_body), 200)));
  end if;
  return v_id;
end $$;
revoke execute on function public.mix_note_add(uuid, integer, text, uuid) from public, anon;
grant execute on function public.mix_note_add(uuid, integer, text, uuid) to authenticated;

create or replace function public.mix_note_resolve(p_note uuid, p_resolved boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid; v_author uuid;
begin
  select project_id, creator_id into v_project, v_author from public.project_mix_notes where id = p_note;
  if v_project is null or not app.can_see_project(v_project) then raise exception 'note not found' using errcode = 'P0002'; end if;
  if v_author is distinct from v_me and not app.manages_project(v_project) then
    raise exception 'only its author or the Room''s owner resolves a note' using errcode = '42501';
  end if;
  update public.project_mix_notes
    set resolved_at = case when p_resolved then coalesce(resolved_at, now()) end,
        resolved_by = case when p_resolved then coalesce(resolved_by, v_me) end
  where id = p_note;
end $$;
revoke execute on function public.mix_note_resolve(uuid, boolean) from public, anon;
grant execute on function public.mix_note_resolve(uuid, boolean) to authenticated;
