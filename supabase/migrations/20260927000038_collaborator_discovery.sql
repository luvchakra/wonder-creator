-- P1-10 Creator Relationships & Collaboration Intelligence: find collaborators by fit, not popularity.
-- - find_collaborators() filters by discipline/skill terms, interest, location, availability, the viewer's own network
--   and a project's need, and returns the factual signals behind each result (what matched, how you know each other,
--   published work) so every suggestion can be explained. There is no score and no follower/like counts; results are
--   ordered by how many of the asked-for terms match, then by whether you already know each other, then by name.
-- - Only profiles the viewer may see (visibility, blocks both ways); location only when the creator shows it.
-- - A private shortlist per creator (optionally per project). The people on it are never told.

create table public.collaborator_shortlist (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  candidate_creator_id uuid not null references public.creators(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (candidate_creator_id <> creator_id),
  unique nulls not distinct (creator_id, candidate_creator_id, project_id)
);
create index collaborator_shortlist_candidate_fk_idx on public.collaborator_shortlist(candidate_creator_id);
create index collaborator_shortlist_project_fk_idx on public.collaborator_shortlist(project_id);
alter table public.collaborator_shortlist enable row level security;
create policy collaborator_shortlist_own on public.collaborator_shortlist for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and app.can_view_creator(candidate_creator_id)
    and not app.blocked_between(creator_id, candidate_creator_id)
    and (project_id is null or app.can_read_project(project_id))
  );

create or replace function public.find_collaborators(
  p_terms text[] default '{}',
  p_interest text default null,
  p_location text default null,
  p_availability text[] default array['open', 'selective'],
  p_network_only boolean default false,
  p_project uuid default null,
  p_limit int default 24
)
returns table (
  creator_id uuid, handle text, display_name text, bio text, location text, availability text,
  disciplines text[], skills text[], interests text[], languages text[],
  matched_terms text[], interest_match boolean, location_match boolean,
  shared_crews int, met_in_huddles int, worked_together int, i_follow boolean, follows_me boolean,
  published_pieces int, in_project text
) language sql stable security definer set search_path = ''
as $$
  with me as (select app.current_creator_id() as id),
  terms as (select distinct lower(trim(t)) as t from unnest(coalesce(p_terms, '{}')) t where char_length(trim(t)) between 2 and 60 limit 8),
  base as (
    select c.* from public.creators c, me
    where c.id <> me.id
      and c.onboarding_step = 'complete'
      and app.can_view_creator(c.id)
      and not app.blocked_between(me.id, c.id)
      and c.collaboration_availability = any(coalesce(p_availability, array['open', 'selective']))
      and (p_project is null or app.can_read_project(p_project))
  ),
  enriched as (
    select b.id, b.handle::text as handle, b.display_name, b.bio,
      case when b.show_location then b.location end as location,
      b.collaboration_availability as availability,
      coalesce((select array_agg(d.value order by d.position) from public.creator_disciplines d where d.creator_id = b.id), '{}') as disciplines,
      coalesce((select array_agg(s.value order by s.position) from public.creator_skills s where s.creator_id = b.id), '{}') as skills,
      coalesce((select array_agg(i.value order by i.position) from public.creator_interests i where i.creator_id = b.id), '{}') as interests,
      coalesce((select array_agg(l.value order by l.position) from public.creator_languages l where l.creator_id = b.id), '{}') as languages,
      (select count(distinct mine.crew_id)::int from public.crew_members mine join public.crew_members theirs on theirs.crew_id = mine.crew_id, me
        where mine.creator_id = me.id and theirs.creator_id = b.id and mine.status in ('active', 'left') and theirs.status in ('active', 'left')) as shared_crews,
      coalesce((select r.met_in_huddle_count from public.creator_relationships r, me
        where (r.creator_a = least(me.id, b.id) and r.creator_b = greatest(me.id, b.id))), 0) as met_in_huddles,
      (select count(*)::int from public.artifact_contributors ac join public.artifacts a on a.id = ac.artifact_id, me
        where (a.creator_id = me.id and ac.contributor_creator_id = b.id) or (a.creator_id = b.id and ac.contributor_creator_id = me.id)) as worked_together,
      exists (select 1 from public.creator_follows f, me where f.follower_creator_id = me.id and f.followed_creator_id = b.id) as i_follow,
      exists (select 1 from public.creator_follows f, me where f.follower_creator_id = b.id and f.followed_creator_id = me.id) as follows_me,
      (select count(*)::int from public.artifacts a where a.creator_id = b.id and a.privacy = 'public' and a.status = 'published') as published_pieces,
      (select m.status from public.crews cr join public.crew_members m on m.crew_id = cr.id
        where p_project is not null and cr.project_id = p_project and m.creator_id = b.id and m.status in ('active', 'invited') limit 1) as in_project
    from base b
  ),
  matched as (
    select e.*,
      coalesce((select array_agg(t.t order by t.t) from terms t
        where exists (select 1 from unnest(e.disciplines || e.skills) v where lower(v) like '%' || t.t || '%')), '{}') as matched_terms,
      p_interest is not null and exists (select 1 from unnest(e.interests) v where lower(v) like '%' || lower(trim(p_interest)) || '%') as interest_match,
      p_location is not null and e.location is not null and lower(e.location) like '%' || lower(trim(p_location)) || '%' as location_match
    from enriched e
  )
  select m.id, m.handle, m.display_name, m.bio, m.location, m.availability, m.disciplines, m.skills, m.interests, m.languages,
    m.matched_terms, m.interest_match, m.location_match, m.shared_crews, m.met_in_huddles, m.worked_together, m.i_follow, m.follows_me,
    m.published_pieces, m.in_project
  from matched m
  where (not exists (select 1 from terms) or cardinality(m.matched_terms) > 0)
    and (p_interest is null or m.interest_match)
    and (p_location is null or m.location_match)
    and (not coalesce(p_network_only, false) or m.shared_crews > 0 or m.met_in_huddles > 0 or m.worked_together > 0 or m.i_follow or m.follows_me)
  order by cardinality(m.matched_terms) desc,
    (m.shared_crews > 0 or m.met_in_huddles > 0 or m.worked_together > 0) desc,
    m.display_name
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;
revoke execute on function public.find_collaborators(text[], text, text, text[], boolean, uuid, int) from public, anon;
grant execute on function public.find_collaborators(text[], text, text, text[], boolean, uuid, int) to authenticated;
