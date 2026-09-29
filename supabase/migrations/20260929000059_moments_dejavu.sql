-- Phase 01 — Moments + DejaVu foundation (docs/moments-dejavu.md).
--
-- A Moment is a cross-domain *reference* with a small preview, never the canonical object: Materials stay Materials,
-- Creations stay Creations, and their tables keep their truth and their access rules. A DejaVu is a creator's recurring
-- thread (a person, place, idea, feeling) that connects Moments across time. Suggestions from CreativeMind are kept
-- apart and are only ever attached by the creator.
--
-- Access: a Moment can only reference what its creator can open right now, and its visibility can be equal to or
-- more restrictive than the underlying entity — never less. Deleting the entity deletes its Moments (and their DejaVu
-- links); making it more private narrows them.

-- ---------------------------------------------------------------------------------------------------------- Moments
create table public.moment_references (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'material', 'creation', 'creation_fragment', 'scrapbook_entry', 'conversation', 'conversation_reply', 'huddle',
    'huddle_moment', 'person_interaction', 'collaboration_request', 'project_activity', 'creative_room_activity',
    'published_work', 'quick_text_note', 'voice_note'
  )),
  entity_id uuid not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'community', 'public')),
  title text check (title is null or char_length(title) <= 200),
  excerpt text check (excerpt is null or char_length(excerpt) <= 280),
  preview_asset_id uuid references public.storage_objects(id) on delete set null,
  preview_kind text check (preview_kind is null or preview_kind in ('text', 'image', 'audio', 'video', 'mixed')),
  subtype text check (subtype is null or char_length(subtype) <= 40),
  source_creator_id uuid references public.creators(id) on delete set null,
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  rights_state text check (rights_state is null or char_length(rights_state) <= 40),
  attribution_required boolean not null default false,
  deleted_at timestamptz,
  unique (creator_id, entity_type, entity_id)
);
create index moment_references_creator_idx on public.moment_references(creator_id, occurred_at desc, id desc);
create index moment_references_entity_idx on public.moment_references(entity_type, entity_id);
create trigger moment_references_touch before update on public.moment_references for each row execute function app.touch_updated_at();

create or replace function app.visibility_rank(p text)
returns int language sql immutable set search_path = ''
as $$ select case p when 'private' then 0 when 'shared' then 1 when 'community' then 2 when 'public' then 3 else 0 end $$;

-- The widest a Moment of this entity may be (null when the entity is gone). Security definer: it only reads the
-- entity's own privacy; whether the caller may reference it at all is `can_see_moment_entity`, checked as the caller.
create or replace function app.moment_entity_visibility(p_type text, p_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'material' then (select case when m.privacy = 'public' then 'public' when m.privacy in ('shared', 'collaborator_only') then 'shared' else 'private' end from public.creative_materials m where m.id = p_id)
    when 'creation' then (
      select case
        when a.privacy = 'public' and a.status in ('final', 'published') then 'public'
        when a.privacy in ('shared', 'collaborator_only') then 'shared'
        else 'private' end
      from public.artifacts a where a.id = p_id)
    else null
  end
$$;

-- Can the caller reference this entity right now? Security invoker: the caller's own RLS decides. Only Materials and
-- Creations are wired in this phase; every other kind stays closed until its adapter lands.
create or replace function app.can_see_moment_entity(p_type text, p_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case p_type
    when 'material' then exists (select 1 from public.creative_materials m where m.id = p_id)
    when 'creation' then app.can_read_artifact(p_id)
    else false
  end
$$;

alter table public.moment_references enable row level security;
create policy moment_references_read on public.moment_references for select to authenticated using (creator_id = app.current_creator_id());
create policy moment_references_insert on public.moment_references for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and app.can_see_moment_entity(entity_type, entity_id)
    and app.visibility_rank(visibility) <= app.visibility_rank(app.moment_entity_visibility(entity_type, entity_id))
  );
create policy moment_references_update on public.moment_references for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and app.visibility_rank(visibility) <= app.visibility_rank(app.moment_entity_visibility(entity_type, entity_id))
  );
create policy moment_references_delete on public.moment_references for delete to authenticated using (creator_id = app.current_creator_id());
revoke update on public.moment_references from authenticated;
grant update (occurred_at, visibility, title, excerpt, preview_asset_id, preview_kind, subtype, deleted_at) on public.moment_references to authenticated;

-- ---------------------------------------------------------------------------------------------------------- DejaVus
create table public.dejavus (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- "Railways" and " railways " are the same thread: one per creator.
  normalized_name text generated always as (lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))) stored,
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (creator_id, normalized_name)
);
create index dejavus_recent_idx on public.dejavus(creator_id, last_used_at desc);
create trigger dejavus_touch before update on public.dejavus for each row execute function app.touch_updated_at();

alter table public.dejavus enable row level security;
create policy dejavus_read on public.dejavus for select to authenticated using (creator_id = app.current_creator_id());
create policy dejavus_insert on public.dejavus for insert to authenticated with check (creator_id = app.current_creator_id());
create policy dejavus_update on public.dejavus for update to authenticated using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy dejavus_delete on public.dejavus for delete to authenticated using (creator_id = app.current_creator_id());
revoke update on public.dejavus from authenticated;
grant update (name, description, archived_at) on public.dejavus to authenticated;

create table public.dejavu_moments (
  id uuid primary key default gen_random_uuid(),
  dejavu_id uuid not null references public.dejavus(id) on delete cascade,
  moment_id uuid not null references public.moment_references(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  added_by uuid references public.creators(id) on delete set null,
  source text not null default 'user' check (source in ('user', 'creativemind_suggestion_accepted', 'migration')),
  created_at timestamptz not null default now(),
  unique (dejavu_id, moment_id)
);
create index dejavu_moments_moment_idx on public.dejavu_moments(moment_id);
create index dejavu_moments_creator_idx on public.dejavu_moments(creator_id);

alter table public.dejavu_moments enable row level security;
create policy dejavu_moments_read on public.dejavu_moments for select to authenticated using (creator_id = app.current_creator_id());
create policy dejavu_moments_insert on public.dejavu_moments for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and added_by = app.current_creator_id()
    and source in ('user', 'creativemind_suggestion_accepted')
    and exists (select 1 from public.dejavus d where d.id = dejavu_id and d.creator_id = app.current_creator_id())
    and exists (select 1 from public.moment_references m where m.id = moment_id and m.creator_id = app.current_creator_id())
  );
create policy dejavu_moments_delete on public.dejavu_moments for delete to authenticated using (creator_id = app.current_creator_id());
revoke update on public.dejavu_moments from authenticated;

-- "Recent" in the Add sheet: a DejaVu used a moment ago comes first.
create or replace function app.dejavu_touch_used()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.dejavus set last_used_at = now() where id = new.dejavu_id;
  return new;
end
$$;
create trigger dejavu_moments_used after insert on public.dejavu_moments for each row execute function app.dejavu_touch_used();

-- CreativeMind's suggestions live apart until the creator accepts one (never attached automatically). Only the
-- pipeline (service role) writes them; the creator can only resolve their own.
create table public.dejavu_suggestions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  moment_id uuid not null references public.moment_references(id) on delete cascade,
  suggested_dejavu_id uuid references public.dejavus(id) on delete cascade,
  suggested_name text check (suggested_name is null or char_length(btrim(suggested_name)) between 1 and 60),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  rationale text check (rationale is null or char_length(rationale) <= 280),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (suggested_dejavu_id is not null or suggested_name is not null)
);
create index dejavu_suggestions_moment_idx on public.dejavu_suggestions(moment_id, status);

alter table public.dejavu_suggestions enable row level security;
create policy dejavu_suggestions_read on public.dejavu_suggestions for select to authenticated using (creator_id = app.current_creator_id());
create policy dejavu_suggestions_resolve on public.dejavu_suggestions for update to authenticated
  using (creator_id = app.current_creator_id() and status = 'pending')
  with check (creator_id = app.current_creator_id() and status in ('accepted', 'dismissed'));
revoke insert, update, delete on public.dejavu_suggestions from authenticated;
grant update (status, resolved_at) on public.dejavu_suggestions to authenticated;

-- ---------------------------------------------------------------------------------------- Keeping Moments current
-- New and changed Materials and Creations get their Moment (and a fresh preview) as they're written, so there's no
-- launch-blocking backfill; older items get one the first time they're given a DejaVu (idempotent upsert).
create or replace function app.material_moment_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text := case when new.type in ('image', 'sketch') then 'image' when new.type in ('audio', 'voice') then 'audio' when new.type = 'video' then 'video' else 'text' end;
  v_vis text := app.moment_entity_visibility('material', new.id);
begin
  insert into public.moment_references (creator_id, entity_type, entity_id, occurred_at, visibility, title, excerpt, preview_asset_id, preview_kind, subtype, source_url)
  values (new.creator_id, 'material', new.id, new.created_at, v_vis, left(new.title, 200), left(new.text_content, 280), new.storage_object_id, v_kind, new.type::text, left(new.source_url, 2048))
  on conflict (creator_id, entity_type, entity_id) do nothing;
  if tg_op = 'UPDATE' then
    update public.moment_references r set
      title = left(new.title, 200),
      excerpt = left(new.text_content, 280),
      preview_asset_id = new.storage_object_id,
      preview_kind = v_kind,
      subtype = new.type::text,
      visibility = case when app.visibility_rank(r.visibility) > app.visibility_rank(v_vis) then v_vis else r.visibility end
    where r.entity_type = 'material' and r.entity_id = new.id;
  end if;
  return new;
end
$$;
create trigger creative_materials_moment after insert or update of title, text_content, storage_object_id, type, privacy on public.creative_materials
  for each row execute function app.material_moment_sync();

create or replace function app.artifact_moment_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_vis text := app.moment_entity_visibility('creation', new.id);
  v_asset uuid := (select m.storage_object_id from public.creative_materials m where m.id = new.cover_material_id);
begin
  insert into public.moment_references (creator_id, entity_type, entity_id, occurred_at, visibility, title, excerpt, preview_asset_id, preview_kind, subtype)
  values (new.creator_id, 'creation', new.id, new.created_at, v_vis, left(new.title, 200), left(new.description, 280), v_asset, case when v_asset is null then 'text' else 'image' end, new.artifact_type)
  on conflict (creator_id, entity_type, entity_id) do nothing;
  if tg_op = 'UPDATE' then
    update public.moment_references r set
      title = left(new.title, 200),
      excerpt = left(new.description, 280),
      preview_asset_id = v_asset,
      preview_kind = case when v_asset is null then 'text' else 'image' end,
      subtype = new.artifact_type,
      visibility = case when app.visibility_rank(r.visibility) > app.visibility_rank(v_vis) then v_vis else r.visibility end
    where r.entity_type = 'creation' and r.entity_id = new.id;
  end if;
  return new;
end
$$;
create trigger artifacts_moment after insert or update of title, description, cover_material_id, artifact_type, privacy, status on public.artifacts
  for each row execute function app.artifact_moment_sync();

-- A deleted entity takes its Moments (and their DejaVu links and suggestions) with it.
create or replace function app.entity_moment_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.moment_references where entity_type = tg_argv[0] and entity_id = old.id;
  return old;
end
$$;
create trigger creative_materials_moment_delete after delete on public.creative_materials for each row execute function app.entity_moment_delete('material');
create trigger artifacts_moment_delete after delete on public.artifacts for each row execute function app.entity_moment_delete('creation');
