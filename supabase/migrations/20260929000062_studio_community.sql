-- Phase 04 — CreativeStudio integration: Working Table + Community + DejaVu (docs/studio-integration.md,
-- docs/phases/04-creativestudio-community-dejavu.md).
--
-- The Working Table keeps one model (Available / In use / Pinned) for everything; Community items join it by reference
-- — an Open Conversation, one reply in it, a Scrapbook entry — never as copies. What a creator may bring in is still
-- decided by the owning domain's own read rules (security invoker), so the Studio can't reach anything its owner can't
-- open. Rights stay deterministic and are computed from the source (docs/studio-integration.md §Rights); nothing here
-- lets CreativeMind decide them.

-- ------------------------------------------------------------------------------------------ Community sources
alter table public.studio_sources drop constraint studio_sources_source_type_check;
alter table public.studio_sources add constraint studio_sources_source_type_check
  check (source_type in ('material', 'creation', 'collection', 'comment', 'huddle_moment', 'conversation', 'conversation_reply', 'scrapbook_entry'));

create or replace function app.can_see_studio_source(p_type text, p_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case p_type
    when 'material' then exists (select 1 from public.creative_materials m where m.id = p_id)
    when 'creation' then app.can_read_artifact(p_id)
    when 'collection' then exists (select 1 from public.material_collections c where c.id = p_id)
    when 'comment' then exists (select 1 from public.artifact_comments c where c.id = p_id)
    when 'huddle_moment' then exists (select 1 from public.huddle_preserved_items h where h.id = p_id)
    when 'conversation' then exists (select 1 from public.open_conversations c where c.id = p_id and c.removed_at is null)
    when 'conversation_reply' then exists (select 1 from public.open_conversation_replies r where r.id = p_id and r.deleted_at is null and r.removed_at is null)
    when 'scrapbook_entry' then exists (select 1 from public.scrapbook_posts p where p.id = p_id)
    else false
  end
$$;

-- Two roles for what other people say about the work (§15). Roles describe use, never rights.
alter table public.studio_sources drop constraint studio_sources_roles_check;
alter table public.studio_sources add constraint studio_sources_roles_check
  check (roles <@ array['story', 'visual', 'mood', 'reference', 'fact', 'voice', 'style', 'constraint', 'character', 'structure', 'sound', 'quote', 'feedback', 'creative_direction']::text[] and cardinality(roles) <= 4);

-- ------------------------------------------------------------------------------------------ Session pointers
-- The source row the creator last opened (§10 "last opened may remain open"), the DejaVu they're exploring (§5: its
-- Moments are available, none imported), and Community replies they dismissed from the Studio (§14).
alter table public.studio_sessions
  add column last_opened_source_id uuid references public.studio_sources(id) on delete set null,
  add column dejavu_id uuid references public.dejavus(id) on delete set null,
  add column dismissed_replies uuid[] not null default '{}' check (cardinality(dismissed_replies) <= 500);

drop policy studio_sessions_update on public.studio_sessions;
create policy studio_sessions_update on public.studio_sessions for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and (dejavu_id is null or exists (select 1 from public.dejavus d where d.id = dejavu_id and d.creator_id = app.current_creator_id()))
    and (last_opened_source_id is null or exists (select 1 from public.studio_sources s where s.id = last_opened_source_id and s.session_id = studio_sessions.id))
  );
revoke update on public.studio_sessions from authenticated;
grant update (output_mode, intent, status, draft, draft_base_version_id, draft_saved_at, last_opened_source_id, dejavu_id, dismissed_replies) on public.studio_sessions to authenticated;

-- ------------------------------------------------------------------------------------------ Ask Community
-- "Ask Community" from a selected part of a private Creation (§13): the conversation carries only that excerpt (the
-- slide's words, a passage) and a pointer to the Creation, which stays private — readers get the excerpt, never the
-- Creation. The excerpt is the owner's own words, bounded, and can only sit on a conversation about their own work.
alter table public.open_conversations
  add column source_fragment jsonb check (
    source_fragment is null or (
      jsonb_typeof(source_fragment) = 'object'
      and pg_column_size(source_fragment) <= 4096
      and char_length(coalesce(source_fragment->>'text', '')) <= 1200
    )
  ),
  add constraint open_conversations_fragment_needs_source check (source_fragment is null or source_entity_id is not null);
create index open_conversations_source_idx on public.open_conversations(source_entity_type, source_entity_id) where source_entity_id is not null;
