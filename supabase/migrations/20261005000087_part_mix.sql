-- Listen together (docs/creative-room-parts.md, step 4): the parts' kept takes play as one, each with where it starts
-- and how loud it is. The mix is the Room's, not anyone's Creation: one row per Room, read by whoever can see the
-- Room, changed only through part_mix_set by the people making the work (on a part, or in the crew). It holds
-- settings only — the sound stays in each part's own take, and who hears a take is still part_takes' decision.

create table public.project_mixes (
  project_id uuid primary key references public.projects(id) on delete cascade,
  -- {"<partId>": {"offsetMs": int, "gain": number, "muted": bool}} — parts of this Room only.
  tracks jsonb not null default '{}'::jsonb check (jsonb_typeof(tracks) = 'object' and octet_length(tracks::text) <= 8000),
  updated_by uuid references public.creators(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.project_mixes enable row level security;
create policy project_mixes_read on public.project_mixes for select to authenticated
  using (app.can_see_project(project_id));
revoke insert, update, delete on public.project_mixes from anon, authenticated;

-- Replaces the Room's mix. Every key must be a part of this Room; offsets are -30s…+10min, levels 0…2 (1 = as
-- recorded). Unknown fields are dropped, so nothing else can ride along in the row.
create or replace function public.part_mix_set(p_project uuid, p_tracks jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_clean jsonb := '{}'::jsonb; k text; v jsonb; v_offset numeric; v_gain numeric;
begin
  if not (app.on_a_part_of(p_project, true) or app.project_role(p_project) is not null) then
    raise exception 'only the people making the work change the mix' using errcode = '42501';
  end if;
  if p_tracks is null or jsonb_typeof(p_tracks) <> 'object' then raise exception 'tracks must be an object' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_tracks) loop
    if k !~ '^[0-9a-fA-F-]{36}$' or not exists (select 1 from public.project_parts where id = k::uuid and project_id = p_project) then
      raise exception 'not a part of this Room' using errcode = '22023';
    end if;
    if jsonb_typeof(v) <> 'object'
      or jsonb_typeof(coalesce(v -> 'offsetMs', '0')) <> 'number'
      or jsonb_typeof(coalesce(v -> 'gain', '1')) <> 'number'
      or jsonb_typeof(coalesce(v -> 'muted', 'false')) <> 'boolean' then
      raise exception 'a track is offsetMs, gain and muted' using errcode = '22023';
    end if;
    v_offset := round((coalesce(v ->> 'offsetMs', '0'))::numeric);
    v_gain := round((coalesce(v ->> 'gain', '1'))::numeric, 2);
    if v_offset < -30000 or v_offset > 600000 then raise exception 'a track starts between -30s and 10 minutes' using errcode = '22023'; end if;
    if v_gain < 0 or v_gain > 2 then raise exception 'a level is between 0 and 2' using errcode = '22023'; end if;
    v_clean := v_clean || jsonb_build_object(k, jsonb_build_object('offsetMs', v_offset, 'gain', v_gain, 'muted', coalesce((v ->> 'muted')::boolean, false)));
  end loop;
  insert into public.project_mixes(project_id, tracks, updated_by, updated_at) values (p_project, v_clean, v_me, now())
  on conflict (project_id) do update set tracks = excluded.tracks, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end $$;
revoke execute on function public.part_mix_set(uuid, jsonb) from public, anon;
grant execute on function public.part_mix_set(uuid, jsonb) to authenticated;
