-- P1-15 Brand Affiliation Foundation (creator side only): a creator can opt into brand opportunities and describe
-- the work they'd take on. No brand marketplace, pricing or payments here (explicitly deferred in the plan).
-- - Owner-only table. Others see a short "open to brand work" summary (niches, industries, platforms, deliverables)
--   only when the creator opted in, through public.brand_summary_of(); the rest (boundaries, exclusivity, usage-right
--   preferences, prior collaborations) stays with the creator until a brand workflow (P1-16) asks for it.

create table public.brand_profiles (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  open_to_brands boolean not null default false,
  niches text[] not null default '{}' check (cardinality(niches) <= 12),
  industries text[] not null default '{}' check (cardinality(industries) <= 12),
  regions text[] not null default '{}' check (cardinality(regions) <= 12),
  expertise text[] not null default '{}' check (cardinality(expertise) <= 12),
  platforms text[] not null default '{}' check (cardinality(platforms) <= 12),
  deliverables text[] not null default '{}' check (cardinality(deliverables) <= 12),
  prior_collaborations text[] not null default '{}' check (cardinality(prior_collaborations) <= 20),
  turnaround text check (turnaround is null or char_length(turnaround) <= 120),
  commercial_boundaries text check (commercial_boundaries is null or char_length(commercial_boundaries) <= 1000),
  exclusivity text check (exclusivity is null or char_length(exclusivity) <= 500),
  usage_rights text check (usage_rights is null or char_length(usage_rights) <= 1000),
  updated_at timestamptz not null default now()
);
create trigger brand_profiles_touch before update on public.brand_profiles
  for each row execute function app.touch_updated_at();
alter table public.brand_profiles enable row level security;
create policy brand_profiles_own on public.brand_profiles for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

-- The public "open to brand work" summary. Null unless the creator opted in and the viewer may see them.
create or replace function public.brand_summary_of(p_creator uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case
    when p_creator is null or not app.can_view_creator(p_creator) then null
    when p_creator <> app.current_creator_id() and app.blocked_between(app.current_creator_id(), p_creator) then null
    else (
      select jsonb_build_object('niches', to_jsonb(b.niches), 'industries', to_jsonb(b.industries), 'platforms', to_jsonb(b.platforms), 'deliverables', to_jsonb(b.deliverables))
      from public.brand_profiles b where b.creator_id = p_creator and b.open_to_brands
    )
  end
$$;
revoke all on function public.brand_summary_of(uuid) from public, anon;
grant execute on function public.brand_summary_of(uuid) to authenticated;
