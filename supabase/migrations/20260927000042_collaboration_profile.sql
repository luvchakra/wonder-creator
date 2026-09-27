-- P1-14 Creator Availability & Collaboration Profile: how a creator wants to collaborate.
-- - Availability (open / selective / closed), disciplines and languages already live on creators; this adds the rest:
--   preferred project types, collaboration interests, where they work (remote / local / either + region), typical
--   turnaround, who may contact them, commercial boundaries, optional rate guidance, rights / exclusivity preferences.
-- - Rates are never public by default: rate guidance is private unless the creator shows it to people they've shared
--   a crew with, or to everyone. Others read the profile only through public.collaboration_profile_of(), which applies
--   that choice; the table itself is owner-only.
-- - Contact preference "only people I've worked with": app.can_message() drops the open-availability route for them,
--   so a stranger can't start a direct thread; crews, co-credits and existing relationships still can.

create table public.collaboration_profiles (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  project_types text[] not null default '{}' check (cardinality(project_types) <= 12),
  interests text[] not null default '{}' check (cardinality(interests) <= 12),
  work_mode text not null default 'either' check (work_mode in ('remote', 'local', 'either')),
  region text check (region is null or char_length(region) <= 120),
  turnaround text check (turnaround is null or char_length(turnaround) <= 120),
  contact_preference text not null default 'anyone' check (contact_preference in ('anyone', 'network')),
  commercial_boundaries text check (commercial_boundaries is null or char_length(commercial_boundaries) <= 1000),
  rate_guidance text check (rate_guidance is null or char_length(rate_guidance) <= 300),
  rate_visibility text not null default 'private' check (rate_visibility in ('private', 'collaborators', 'public')),
  rights_preferences text check (rights_preferences is null or char_length(rights_preferences) <= 1000),
  exclusivity text not null default 'open' check (exclusivity in ('open', 'case_by_case', 'non_exclusive_only')),
  updated_at timestamptz not null default now()
);
create trigger collaboration_profiles_touch before update on public.collaboration_profiles
  for each row execute function app.touch_updated_at();
alter table public.collaboration_profiles enable row level security;
create policy collaboration_profiles_own on public.collaboration_profiles for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

-- Have the viewer and this creator been in a crew together (active, invited or former)?
create or replace function app.shared_crew(p_other uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members mine join public.crew_members theirs on theirs.crew_id = mine.crew_id
    where mine.creator_id = app.current_creator_id() and theirs.creator_id = p_other
      and mine.status in ('active', 'invited', 'left') and theirs.status in ('active', 'invited', 'left')
  )
$$;

-- What another creator may see of a collaboration profile. Null when the creator can't be seen or is blocked.
-- Rate guidance only when the owner chose to show it (to everyone, or to people they've shared a crew with).
create or replace function public.collaboration_profile_of(p_creator uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case
    when p_creator is null or not app.can_view_creator(p_creator) then null
    when p_creator <> app.current_creator_id() and app.blocked_between(app.current_creator_id(), p_creator) then null
    else (
      select jsonb_build_object(
        'availability', c.collaboration_availability,
        'projectTypes', coalesce(to_jsonb(p.project_types), '[]'::jsonb),
        'interests', coalesce(to_jsonb(p.interests), '[]'::jsonb),
        'workMode', coalesce(p.work_mode, 'either'),
        'region', p.region,
        'turnaround', p.turnaround,
        'contactPreference', coalesce(p.contact_preference, 'anyone'),
        'commercialBoundaries', p.commercial_boundaries,
        'rightsPreferences', p.rights_preferences,
        'exclusivity', coalesce(p.exclusivity, 'open'),
        'rateGuidance', case
          when p.rate_guidance is null then null
          when p_creator = app.current_creator_id() then p.rate_guidance
          when p.rate_visibility = 'public' then p.rate_guidance
          when p.rate_visibility = 'collaborators' and app.shared_crew(p_creator) then p.rate_guidance
          else null end,
        'hasProfile', p.creator_id is not null
      )
      from public.creators c left join public.collaboration_profiles p on p.creator_id = c.id
      where c.id = p_creator
    )
  end
$$;
revoke all on function public.collaboration_profile_of(uuid) from public, anon;
grant execute on function public.collaboration_profile_of(uuid) to authenticated;

-- Contact preference: "only people I've worked with" removes the open-availability route to a direct thread.
create or replace function app.can_message(p_other uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_other <> app.current_creator_id()
    and app.can_view_creator(p_other)
    and not app.blocked_between(app.current_creator_id(), p_other)
    and (
      exists (select 1 from public.creators c where c.id = p_other and c.collaboration_availability in ('open', 'selective') and c.onboarding_step = 'complete'
                and not exists (select 1 from public.collaboration_profiles cp where cp.creator_id = p_other and cp.contact_preference = 'network'))
      or app.shared_crew(p_other)
      or exists (select 1 from public.artifact_contributors ac join public.artifacts a on a.id = ac.artifact_id
                 where (a.creator_id = app.current_creator_id() and ac.contributor_creator_id = p_other)
                    or (a.creator_id = p_other and ac.contributor_creator_id = app.current_creator_id()))
      or exists (select 1 from public.creator_relationships r
                 where r.creator_a = least(app.current_creator_id(), p_other) and r.creator_b = greatest(app.current_creator_id(), p_other))
    )
$$;
