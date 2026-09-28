-- CreativeStudio Working Set, phase A (docs/ui-redesign/creative-studio-working-set.md §40–48, §76): a StudioSession per
-- creator per Creation, holding *references* to the ingredients brought into the Studio — never copies of them. The
-- owning domains (Materials, Creations, Collections…) keep their truth and their access rules: a source can only be
-- added if the creator can already see it, checked here by the policies themselves. Temporary working state; it does
-- not touch versions or lineage (committed provenance comes later, §38).

create table public.studio_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  output_mode text not null default 'writing' check (output_mode in ('writing', 'image', 'carousel', 'video', 'audio', 'presentation', 'document')),
  intent jsonb not null default '{}' check (jsonb_typeof(intent) = 'object' and pg_column_size(intent) <= 8192),
  status text not null default 'active' check (status in ('active', 'paused', 'committed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, artifact_id)
);
create index studio_sessions_artifact_idx on public.studio_sessions(artifact_id);
create trigger studio_sessions_touch before update on public.studio_sessions for each row execute function app.touch_updated_at();

create table public.studio_sources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.studio_sessions(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  source_type text not null check (source_type in ('material', 'creation', 'collection')),
  source_id uuid not null,
  state text not null default 'available' check (state in ('available', 'in_use', 'pinned')),
  roles text[] not null default '{}' check (roles <@ array['story', 'visual', 'mood', 'reference', 'fact', 'voice', 'style', 'constraint', 'character', 'structure', 'sound', 'quote']::text[] and cardinality(roles) <= 4),
  usage_intent text check (usage_intent is null or usage_intent in ('content', 'style', 'structure', 'mood', 'reference', 'fact', 'quote', 'visual', 'sound')),
  added_by uuid not null references public.creators(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (session_id, source_type, source_id)
);
create index studio_sources_session_idx on public.studio_sources(session_id, added_at desc);
create index studio_sources_creator_idx on public.studio_sources(creator_id);

-- Can the caller see this source right now? Evaluated with the caller's own RLS (security invoker), so the Studio can
-- never reference what its owner can't open.
create or replace function app.can_see_studio_source(p_type text, p_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case p_type
    when 'material' then exists (select 1 from public.creative_materials m where m.id = p_id)
    when 'creation' then app.can_read_artifact(p_id)
    when 'collection' then exists (select 1 from public.material_collections c where c.id = p_id)
    else false
  end
$$;

alter table public.studio_sessions enable row level security;
create policy studio_sessions_read on public.studio_sessions for select to authenticated using (creator_id = app.current_creator_id());
create policy studio_sessions_insert on public.studio_sessions for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id));
create policy studio_sessions_update on public.studio_sessions for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy studio_sessions_delete on public.studio_sessions for delete to authenticated using (creator_id = app.current_creator_id());
revoke update on public.studio_sessions from authenticated;
grant update (output_mode, intent, status) on public.studio_sessions to authenticated;

alter table public.studio_sources enable row level security;
create policy studio_sources_read on public.studio_sources for select to authenticated using (creator_id = app.current_creator_id());
create policy studio_sources_insert on public.studio_sources for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and added_by = app.current_creator_id()
    and exists (select 1 from public.studio_sessions s where s.id = session_id and s.creator_id = app.current_creator_id())
    and app.can_see_studio_source(source_type, source_id)
  );
create policy studio_sources_update on public.studio_sources for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy studio_sources_delete on public.studio_sources for delete to authenticated using (creator_id = app.current_creator_id());
revoke update on public.studio_sources from authenticated;
grant update (state, roles, usage_intent) on public.studio_sources to authenticated;
