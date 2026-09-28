-- CreativeStudio Working Set, phases B–D data (docs/ui-redesign/creative-studio-working-set.md §19–23, §34–35, §43–46):
-- collaborator comments and Huddle moments as sources, fragments of a source (a time range, a passage), the session's
-- autosaved canvas draft and its creative intent. Still references only; the owning domains keep their truth.

-- More kinds of source. A comment is visible to whoever can see the Creation; a Huddle moment to whoever saved it.
alter table public.studio_sources drop constraint studio_sources_source_type_check;
alter table public.studio_sources add constraint studio_sources_source_type_check
  check (source_type in ('material', 'creation', 'collection', 'comment', 'huddle_moment'));

create or replace function app.can_see_studio_source(p_type text, p_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case p_type
    when 'material' then exists (select 1 from public.creative_materials m where m.id = p_id)
    when 'creation' then app.can_read_artifact(p_id)
    when 'collection' then exists (select 1 from public.material_collections c where c.id = p_id)
    when 'comment' then exists (select 1 from public.artifact_comments c where c.id = p_id)
    when 'huddle_moment' then exists (select 1 from public.huddle_preserved_items h where h.id = p_id)
    else false
  end
$$;

-- Fragments (§19–21, §42): a usable piece of a source. The same source may be on the table whole and as several
-- fragments, so the uniqueness key includes the fragment.
alter table public.studio_sources
  add column fragment jsonb check (fragment is null or (jsonb_typeof(fragment) = 'object' and pg_column_size(fragment) <= 4096)),
  add column fragment_key text not null generated always as (coalesce(md5(fragment::text), '')) stored;
alter table public.studio_sources drop constraint studio_sources_session_id_source_type_source_id_key;
alter table public.studio_sources add constraint studio_sources_unique_source unique (session_id, source_type, source_id, fragment_key);
revoke update on public.studio_sources from authenticated;
grant update (state, roles, usage_intent) on public.studio_sources to authenticated;

-- The canvas draft (§44–47): autosaved text between durable versions. Never a version by itself.
alter table public.studio_sessions
  add column draft text check (draft is null or char_length(draft) <= 500000),
  add column draft_base_version_id uuid references public.artifact_versions(id) on delete set null,
  add column draft_saved_at timestamptz;
revoke update on public.studio_sessions from authenticated;
grant update (output_mode, intent, status, draft, draft_base_version_id, draft_saved_at) on public.studio_sessions to authenticated;
