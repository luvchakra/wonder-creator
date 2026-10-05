-- Completion, part one (docs/creative-room-parts.md, step 5a): once every part is final, the Room's owner or admins
-- propose the credits and shares — each person credited for their part (Lyrics → writing, Tune → sound, Voice →
-- performance), shares equal per person unless edited — and everyone on it signs off. It is agreed only when all of
-- them have; a part that moves on afterwards means proposing again. The agreement covers the parts' versions at the
-- time, so "what we agreed to" is never a guess. Publishing the song together (5b) needs an agreement that still holds.

-- What a part is credited as. Set from its kind; a template or the proposal says more (Voice is performance).
alter table public.project_parts add column credit text check (credit in ('writing', 'sound', 'performance', 'design', 'production', 'other'));
update public.project_parts set credit = case
  when kind = 'audio' and lower(title) in ('voice', 'vocals', 'host', 'narration', 'singer') then 'performance'
  when kind = 'writing' then 'writing'
  when kind = 'audio' then 'sound'
  when kind = 'image' then 'design'
  when kind = 'video' then 'production'
  else 'other' end;
create or replace function app.part_credit_default()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.credit is null then
    new.credit := case new.kind when 'writing' then 'writing' when 'audio' then 'sound' when 'image' then 'design' when 'video' then 'production' else 'other' end;
  end if;
  return new;
end $$;
create trigger project_parts_credit_default before insert on public.project_parts
  for each row execute function app.part_credit_default();
alter table public.project_parts alter column credit set not null;

create table public.project_song_agreements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  proposed_by uuid references public.creators(id) on delete set null,
  -- [{creatorId, name, percent, parts: [{partId, title, credit}]}] — everyone on a part, once.
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 50),
  -- [{partId, title, artifactId, versionId, versionNumber}] — what was agreed to.
  versions jsonb not null check (jsonb_typeof(versions) = 'array'),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'agreed', 'replaced')),
  created_at timestamptz not null default now(),
  agreed_at timestamptz
);
create unique index project_song_agreements_current on public.project_song_agreements(project_id) where status in ('open', 'agreed');
create index project_song_agreements_project_idx on public.project_song_agreements(project_id, created_at desc);

create table public.project_song_signoffs (
  agreement_id uuid not null references public.project_song_agreements(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  decision text not null check (decision in ('approve', 'object')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (agreement_id, creator_id)
);

alter table public.project_song_agreements enable row level security;
alter table public.project_song_signoffs enable row level security;
create policy project_song_agreements_read on public.project_song_agreements for select to authenticated
  using (app.can_see_project(project_id));
create policy project_song_signoffs_read on public.project_song_signoffs for select to authenticated
  using (exists (select 1 from public.project_song_agreements g where g.id = agreement_id and app.can_see_project(g.project_id)));
revoke insert, update, delete on public.project_song_agreements, public.project_song_signoffs from anon, authenticated;

-- Do an agreement's versions still stand? (every part's current version is the one agreed to)
create or replace function app.song_agreement_holds(p_agreement uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.project_song_agreements g
    cross join lateral jsonb_array_elements(g.versions) v
    left join public.artifacts a on a.id = (v ->> 'artifactId')::uuid
    where g.id = p_agreement and (a.id is null or a.current_version_id is distinct from (v ->> 'versionId')::uuid)
  )
$$;
revoke execute on function app.song_agreement_holds(uuid) from public, anon;
grant execute on function app.song_agreement_holds(uuid) to authenticated;

-- Propose the credits and shares. p_credits {partId: credit} sets what a part is credited as; p_shares
-- {creatorId: percent} replaces the equal split (everyone on it, each 0–100, two decimals, 100 in all).
create or replace function public.song_propose(p_project uuid, p_shares jsonb default null, p_credits jsonb default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.require_creator(); v_id uuid; v_people uuid[]; v_n int; v_lines jsonb := '[]'::jsonb; v_versions jsonb;
  v_who uuid; v_i int := 0; v_bp int; v_total numeric := 0; v_pct numeric; k text; v text;
begin
  if not app.manages_project(p_project) then raise exception 'only the Room''s owner or admins propose the credits' using errcode = '42501'; end if;
  if not exists (select 1 from public.project_parts where project_id = p_project) then raise exception 'this Room has no parts' using errcode = '22023'; end if;
  if exists (select 1 from public.project_parts pp left join public.artifacts a on a.id = pp.artifact_id
             where pp.project_id = p_project and (pp.status <> 'final' or a.current_version_id is null)) then
    raise exception 'every part must be final first' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'a shorter note, please' using errcode = '22023'; end if;
  if p_credits is not null then
    if jsonb_typeof(p_credits) <> 'object' then raise exception 'credits must be an object' using errcode = '22023'; end if;
    for k, v in select key, value from jsonb_each_text(p_credits) loop
      if k !~ '^[0-9a-fA-F-]{36}$' or not exists (select 1 from public.project_parts where id = k::uuid and project_id = p_project) then
        raise exception 'not a part of this Room' using errcode = '22023';
      end if;
      if v not in ('writing', 'sound', 'performance', 'design', 'production', 'other') then raise exception 'not a credit' using errcode = '22023'; end if;
      update public.project_parts set credit = v, updated_at = now() where id = k::uuid;
    end loop;
  end if;

  -- Everyone on a part, once, in the order of the parts and when they joined.
  select array_agg(creator_id order by first_pos, first_joined) into v_people from (
    select m.creator_id, min(pp.position) as first_pos, min(m.joined_at) as first_joined
    from public.project_parts pp join public.project_part_members m on m.part_id = pp.id and m.status = 'active'
    where pp.project_id = p_project group by m.creator_id
  ) x;
  v_n := coalesce(array_length(v_people, 1), 0);
  if v_n = 0 then raise exception 'no one is on a part' using errcode = '22023'; end if;

  if p_shares is not null then
    if jsonb_typeof(p_shares) <> 'object' then raise exception 'shares must be an object' using errcode = '22023'; end if;
    if (select count(*) from jsonb_object_keys(p_shares)) <> v_n
       or exists (select 1 from jsonb_object_keys(p_shares) s where s !~ '^[0-9a-fA-F-]{36}$' or not (s::uuid = any (v_people))) then
      raise exception 'a share for everyone on the work, and no one else' using errcode = '22023';
    end if;
    for k, v in select key, value from jsonb_each_text(p_shares) loop
      if v !~ '^\d{1,3}(\.\d{1,2})?$' or v::numeric > 100 then raise exception 'a share is 0–100, to two decimals' using errcode = '22023'; end if;
      v_total := v_total + v::numeric;
    end loop;
    if v_total <> 100 then raise exception 'shares add up to 100' using errcode = '22023'; end if;
  end if;

  foreach v_who in array v_people loop
    v_i := v_i + 1;
    if p_shares is not null then
      v_pct := (p_shares ->> v_who::text)::numeric;
    else
      -- Equal, in hundredths; the leftover hundredths go to the first people, one each.
      v_bp := 10000 / v_n + case when v_i <= 10000 % v_n then 1 else 0 end;
      v_pct := v_bp / 100.0;
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'creatorId', v_who,
      'name', (select display_name from public.creators where id = v_who),
      'percent', round(v_pct, 2),
      'parts', (select coalesce(jsonb_agg(jsonb_build_object('partId', pp.id, 'title', pp.title, 'credit', pp.credit) order by pp.position, pp.created_at), '[]'::jsonb)
                from public.project_parts pp join public.project_part_members m on m.part_id = pp.id and m.status = 'active' and m.creator_id = v_who
                where pp.project_id = p_project)
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('partId', pp.id, 'title', pp.title, 'artifactId', pp.artifact_id, 'versionId', a.current_version_id, 'versionNumber', ver.version_number) order by pp.position, pp.created_at), '[]'::jsonb)
    into v_versions
  from public.project_parts pp join public.artifacts a on a.id = pp.artifact_id join public.artifact_versions ver on ver.id = a.current_version_id
  where pp.project_id = p_project;

  update public.project_song_agreements set status = 'replaced' where project_id = p_project and status in ('open', 'agreed');
  insert into public.project_song_agreements(project_id, proposed_by, lines, versions, note)
  values (p_project, v_me, v_lines, v_versions, nullif(trim(p_note), ''))
  returning id into v_id;
  -- Proposing is agreeing, for a proposer who is on the work.
  if v_me = any (v_people) then
    insert into public.project_song_signoffs(agreement_id, creator_id, decision) values (v_id, v_me, 'approve');
    if v_n = 1 then update public.project_song_agreements set status = 'agreed', agreed_at = now() where id = v_id; end if;
  end if;
  perform app.record_audit('song.proposed', 'project', p_project, jsonb_build_object('agreementId', v_id, 'people', v_n, 'equal', p_shares is null), null);
  return v_id;
end $$;
revoke execute on function public.song_propose(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.song_propose(uuid, jsonb, jsonb, text) to authenticated;

-- Sign off on (or object to) the credits and shares — only someone named in them, only while open, and only while the
-- parts are still the versions agreed to. When everyone has signed off, it is agreed.
create or replace function public.song_sign(p_agreement uuid, p_decision text, p_note text default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); g public.project_song_agreements; v_named int; v_signed int;
begin
  select * into g from public.project_song_agreements where id = p_agreement;
  if g.id is null or not app.can_see_project(g.project_id) then raise exception 'agreement not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from jsonb_array_elements(g.lines) l where (l ->> 'creatorId')::uuid = v_me) then
    raise exception 'only the people credited sign off' using errcode = '42501';
  end if;
  if g.status <> 'open' then raise exception 'this proposal is no longer open' using errcode = '22023'; end if;
  if not app.song_agreement_holds(g.id) then raise exception 'a part moved on since this was proposed — it needs proposing again' using errcode = '22023'; end if;
  if p_decision not in ('approve', 'object') then raise exception 'approve or object' using errcode = '22023'; end if;
  if p_decision = 'object' and coalesce(trim(p_note), '') = '' then raise exception 'say what you''d change' using errcode = '22023'; end if;
  if p_note is not null and char_length(p_note) > 500 then raise exception 'a shorter note, please' using errcode = '22023'; end if;
  insert into public.project_song_signoffs(agreement_id, creator_id, decision, note) values (g.id, v_me, p_decision, nullif(trim(p_note), ''))
  on conflict (agreement_id, creator_id) do update set decision = excluded.decision, note = excluded.note, created_at = now();
  select jsonb_array_length(g.lines) into v_named;
  select count(*) into v_signed from public.project_song_signoffs where agreement_id = g.id and decision = 'approve';
  if v_signed = v_named then
    update public.project_song_agreements set status = 'agreed', agreed_at = now() where id = g.id;
  end if;
  perform app.record_audit('song.' || case when p_decision = 'approve' then 'signed_off' else 'objected' end, 'project', g.project_id, jsonb_build_object('agreementId', g.id), null);
  return case when v_signed = v_named then 'agreed' else 'open' end;
end $$;
revoke execute on function public.song_sign(uuid, text, text) from public, anon;
grant execute on function public.song_sign(uuid, text, text) to authenticated;
