-- P1-01 Project Domain: an explicit project container that references a creator's work without replacing it.
-- - Materials, artifacts, references, collections and conversations stay their own objects. A project only
--   links to them (project_items), so deleting a project, or unlinking something, never deletes the work.
-- - Linking is permission-checked: you can link only what you own (or, for pieces, can read) and Huddles you
--   were part of. A Huddle link keeps no Huddle content, only the topic you saw when you linked it.
-- - A conversation can belong to a project, so CreatorBrain works with the project's brief and goals, and
--   pieces made there are linked to the project.
-- - Projects are private to their owner in P1-01; CreatorCrew (P1-02) widens reading through app.can_read_project.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  brief text not null default '' check (char_length(brief) <= 5000),
  goals text[] not null default '{}' check (cardinality(goals) <= 12),
  status text not null default 'idea' check (status in ('idea', 'active', 'paused', 'completed', 'archived')),
  cover_material_id uuid references public.creative_materials(id) on delete set null,
  rights_note text check (rights_note is null or char_length(rights_note) <= 2000),
  budget_enabled boolean not null default false,
  budget_amount numeric(14, 2) check (budget_amount is null or budget_amount >= 0),
  budget_currency text check (budget_currency is null or budget_currency ~ '^[A-Z]{3}$'),
  budget_note text check (budget_note is null or char_length(budget_note) <= 500),
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_creator_idx on public.projects(creator_id, updated_at desc);
create index projects_cover_material_id_fk_idx on public.projects(cover_material_id);
create trigger projects_touch before update on public.projects
  for each row execute function app.touch_updated_at();

-- Goals are short lines.
create or replace function app.check_project_goals()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.goals) g where char_length(g) not between 1 and 300) then
    raise exception 'Each goal needs 1 to 300 characters.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    new.status_changed_at := now();
  elsif new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;
create trigger projects_check before insert or update on public.projects
  for each row execute function app.check_project_goals();

create or replace function app.owns_project(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.projects p where p.id = p_project and p.creator_id = app.current_creator_id()) $$;
revoke execute on function app.owns_project(uuid) from public, anon;
grant execute on function app.owns_project(uuid) to authenticated;

-- Who can read a project (owner only for now; CreatorCrew adds members).
create or replace function app.can_read_project(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.owns_project(p_project) $$;
revoke execute on function app.can_read_project(uuid) from public, anon;
grant execute on function app.can_read_project(uuid) to authenticated;

alter table public.projects enable row level security;
create policy projects_read on public.projects for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_read_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (creator_id = app.current_creator_id() and (cover_material_id is null or app.owns_material(cover_material_id)));
create policy projects_update on public.projects for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and (cover_material_id is null or app.owns_material(cover_material_id)));
create policy projects_delete on public.projects for delete to authenticated
  using (creator_id = app.current_creator_id());

-- Links ----------------------------------------------------------------------------------------------------------
create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('material', 'reference', 'artifact', 'collection', 'conversation', 'huddle')),
  material_id uuid references public.creative_materials(id) on delete cascade,
  reference_id uuid references public.reference_items(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  collection_id uuid references public.material_collections(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  -- Huddles are ephemeral: no foreign key, and only the topic as the linker saw it.
  huddle_id uuid,
  label text check (label is null or char_length(label) <= 140),
  note text check (note is null or char_length(note) <= 500),
  position int check (position is null or position >= 0),
  added_at timestamptz not null default now(),
  check (num_nonnulls(material_id, reference_id, artifact_id, collection_id, conversation_id, huddle_id) = 1),
  check (case kind
    when 'material' then material_id is not null
    when 'reference' then reference_id is not null
    when 'artifact' then artifact_id is not null
    when 'collection' then collection_id is not null
    when 'conversation' then conversation_id is not null
    else huddle_id is not null end)
);
create unique index project_items_unique on public.project_items(project_id, kind, coalesce(material_id, reference_id, artifact_id, collection_id, conversation_id, huddle_id));
create index project_items_project_idx on public.project_items(project_id, kind, added_at desc);
create index project_items_creator_id_fk_idx on public.project_items(creator_id);
create index project_items_material_id_fk_idx on public.project_items(material_id);
create index project_items_reference_id_fk_idx on public.project_items(reference_id);
create index project_items_artifact_id_fk_idx on public.project_items(artifact_id);
create index project_items_collection_id_fk_idx on public.project_items(collection_id);
create index project_items_conversation_id_fk_idx on public.project_items(conversation_id);

alter table public.project_items enable row level security;
create policy project_items_read on public.project_items for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_read_project(project_id));
create policy project_items_insert on public.project_items for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and app.owns_project(project_id)
    and (material_id is null or app.owns_material(material_id))
    and (reference_id is null or exists (select 1 from public.reference_items r where r.id = reference_id and r.creator_id = app.current_creator_id()))
    and (artifact_id is null or app.can_read_artifact(artifact_id))
    and (collection_id is null or app.owns_collection(collection_id))
    and (conversation_id is null or app.owns_conversation(conversation_id))
    and (huddle_id is null or app.is_huddle_participant(huddle_id) or app.was_huddle_participant(huddle_id))
  );
create policy project_items_update on public.project_items for update to authenticated
  using (app.owns_project(project_id)) with check (app.owns_project(project_id));
create policy project_items_delete on public.project_items for delete to authenticated
  using (app.owns_project(project_id));
-- Only the note and order change after linking; what a link points to never does.
revoke update on public.project_items from authenticated;
grant update (note, position) on public.project_items to authenticated;

-- Conversations can belong to a project (CreatorBrain uses its brief and goals).
alter table public.conversations add column project_id uuid references public.projects(id) on delete set null;
create index conversations_project_id_fk_idx on public.conversations(project_id);
drop policy conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert to authenticated
  with check (creator_id = app.current_creator_id()
              and (collection_id is null or app.owns_collection(collection_id))
              and (project_id is null or app.owns_project(project_id)));
drop policy conversations_update on public.conversations;
create policy conversations_update on public.conversations for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id()
              and (collection_id is null or app.owns_collection(collection_id))
              and (project_id is null or app.owns_project(project_id)));

-- Audit: creating, status changes and deleting (never the brief itself).
create or replace function app.audit_project()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit('project.created', 'project', new.id, jsonb_build_object('status', new.status), null);
  elsif tg_op = 'DELETE' then
    perform app.record_audit('project.deleted', 'project', old.id, jsonb_build_object('title', old.title), null);
    return old;
  elsif new.status is distinct from old.status then
    perform app.record_audit('project.status', 'project', new.id, jsonb_build_object('from', old.status, 'to', new.status), null);
  end if;
  return new;
end $$;
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function app.audit_project();
revoke execute on function app.audit_project() from public, anon, authenticated;
