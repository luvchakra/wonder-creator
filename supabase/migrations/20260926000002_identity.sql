-- Creator identity, creative voice, boundaries, autonomy and relationships.

create type public.autonomy_domain as enum (
  'creative_generation', 'research', 'transformation', 'organization', 'collaboration',
  'communication', 'publishing', 'commerce', 'rights', 'destructive_actions'
);
create type public.autonomy_level as enum (
  'never', 'observe', 'suggest', 'draft', 'execute_with_approval', 'auto_execute'
);

-- Identity facets: normalized because they are queried, filtered and shown publicly.
create table public.creator_disciplines (
  creator_id uuid not null references public.creators(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 60),
  position smallint not null default 0,
  primary key (creator_id, value)
);
create table public.creator_skills (
  creator_id uuid not null references public.creators(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 60),
  position smallint not null default 0,
  primary key (creator_id, value)
);
create table public.creator_languages (
  creator_id uuid not null references public.creators(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 60),
  position smallint not null default 0,
  primary key (creator_id, value)
);
create table public.creator_interests (
  creator_id uuid not null references public.creators(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 60),
  position smallint not null default 0,
  primary key (creator_id, value)
);
create index creator_disciplines_value_idx on public.creator_disciplines(lower(value));

-- Creative voice & visual preferences (private to the creator).
create table public.creator_voice_profiles (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  tones text[] not null default '{}',
  formality text check (formality in ('casual', 'balanced', 'formal')),
  writing_style text check (writing_style in ('concise', 'detailed', 'narrative', 'technical', 'poetic', 'experimental')),
  vocabulary text check (vocabulary is null or char_length(vocabulary) <= 300),
  language_style text check (language_style is null or char_length(language_style) <= 300),
  code_switching boolean not null default false,
  narrative_style text check (narrative_style is null or char_length(narrative_style) <= 300),
  recurring_themes text[] not null default '{}',
  visual_styles text[] not null default '{}',
  visual_moods text[] not null default '{}',
  color_preferences text[] not null default '{}',
  composition_notes text check (composition_notes is null or char_length(composition_notes) <= 500),
  experimentation text not null default 'balanced' check (experimentation in ('stay_close', 'balanced', 'experiment')),
  updated_at timestamptz not null default now()
);
create trigger voice_touch before update on public.creator_voice_profiles
  for each row execute function app.touch_updated_at();

create table public.creator_boundaries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('preserve', 'avoid', 'authorship', 'cultural', 'sensitive')),
  label text not null check (char_length(label) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (creator_id, kind, label)
);

create table public.creator_autonomy_policies (
  creator_id uuid not null references public.creators(id) on delete cascade,
  domain public.autonomy_domain not null,
  level public.autonomy_level not null,
  updated_at timestamptz not null default now(),
  primary key (creator_id, domain)
);
create trigger autonomy_touch before update on public.creator_autonomy_policies
  for each row execute function app.touch_updated_at();

-- Rights, commerce and destructive actions can never be raised to auto-execute.
create or replace function app.guard_autonomy_level()
returns trigger language plpgsql as $$
begin
  if new.domain in ('rights', 'commerce', 'destructive_actions') and new.level = 'auto_execute' then
    raise exception 'auto-execute is not allowed for %', new.domain using errcode = '22023';
  end if;
  return new;
end $$;
create trigger autonomy_guard before insert or update on public.creator_autonomy_policies
  for each row execute function app.guard_autonomy_level();

-- Relationship signals (e.g. met in a Huddle). Never shown as a popularity metric.
create table public.creator_relationships (
  creator_a uuid not null references public.creators(id) on delete cascade,
  creator_b uuid not null references public.creators(id) on delete cascade,
  met_in_huddle_count int not null default 0,
  last_met_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (creator_a, creator_b),
  check (creator_a < creator_b)
);

-- Follows are a lightweight, reversible connection.
create table public.creator_follows (
  follower_creator_id uuid not null references public.creators(id) on delete cascade,
  followed_creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_creator_id, followed_creator_id),
  check (follower_creator_id <> followed_creator_id)
);

-- Seed product-default autonomy (visible and editable; not hidden behaviour).
create or replace function app.seed_creator_defaults()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.creator_autonomy_policies(creator_id, domain, level) values
    (new.id, 'creative_generation', 'auto_execute'),
    (new.id, 'research', 'auto_execute'),
    (new.id, 'transformation', 'draft'),
    (new.id, 'organization', 'draft'),
    (new.id, 'collaboration', 'execute_with_approval'),
    (new.id, 'communication', 'execute_with_approval'),
    (new.id, 'publishing', 'execute_with_approval'),
    (new.id, 'commerce', 'never'),
    (new.id, 'rights', 'never'),
    (new.id, 'destructive_actions', 'never');
  insert into public.creator_voice_profiles(creator_id) values (new.id);
  return new;
end $$;
create trigger creators_seed_defaults after insert on public.creators
  for each row execute function app.seed_creator_defaults();

-- RLS ------------------------------------------------------------------------
alter table public.creator_disciplines enable row level security;
alter table public.creator_skills enable row level security;
alter table public.creator_languages enable row level security;
alter table public.creator_interests enable row level security;
alter table public.creator_voice_profiles enable row level security;
alter table public.creator_boundaries enable row level security;
alter table public.creator_autonomy_policies enable row level security;
alter table public.creator_relationships enable row level security;
alter table public.creator_follows enable row level security;

do $$
declare t text;
begin
  foreach t in array array['creator_disciplines', 'creator_skills', 'creator_languages', 'creator_interests'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.can_view_creator(creator_id))', t);
    execute format('create policy %1$s_anon_read on public.%1$s for select to anon using (app.can_view_creator(creator_id))', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id())', t);
  end loop;
end $$;

create policy voice_own on public.creator_voice_profiles for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy boundaries_own on public.creator_boundaries for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy autonomy_own_read on public.creator_autonomy_policies for select to authenticated
  using (creator_id = app.current_creator_id());
create policy autonomy_own_update on public.creator_autonomy_policies for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy relationships_party_read on public.creator_relationships for select to authenticated
  using (app.current_creator_id() in (creator_a, creator_b));

create policy follows_read on public.creator_follows for select to authenticated
  using (follower_creator_id = app.current_creator_id() or followed_creator_id = app.current_creator_id());
create policy follows_write on public.creator_follows for insert to authenticated
  with check (follower_creator_id = app.current_creator_id() and app.can_view_creator(followed_creator_id));
create policy follows_delete on public.creator_follows for delete to authenticated
  using (follower_creator_id = app.current_creator_id());
