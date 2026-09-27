-- P1-04 Crew Workspace.
-- - Sharing into the crew: a link in a project can be "shared with the crew". Only the person who owns the linked
--   work (material, reference or piece) can share it, and anyone in the crew can add their own work (always shared).
--   Crew members read shared work read-only through the security-definer functions below, never through the
--   work's own RLS: sharing into a crew doesn't widen access anywhere else, and unsharing (or unlinking) ends it.
-- - Crew chat: a durable conversation for the crew (unlike Huddles). Active members read and write; authors and the
--   crew's owner/admins can remove messages. A message can point at a shared item.

alter table public.project_items
  add column shared boolean not null default false,
  add column shared_at timestamptz;

-- Whether the link's creator owns the linked work (what can be shared).
create or replace function app.link_target_owned(p_creator uuid, p_material uuid, p_reference uuid, p_artifact uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_material is not null then exists (select 1 from public.creative_materials m where m.id = p_material and m.creator_id = p_creator)
    when p_reference is not null then exists (select 1 from public.reference_items r where r.id = p_reference and r.creator_id = p_creator)
    when p_artifact is not null then exists (select 1 from public.artifacts a where a.id = p_artifact and a.creator_id = p_creator)
    else false
  end
$$;

drop policy project_items_insert on public.project_items;
create policy project_items_insert on public.project_items for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    -- The owner links anything of theirs; crew members add their own work, shared with the crew.
    and (app.owns_project(project_id) or (app.can_read_project(project_id) and shared))
    and (material_id is null or app.owns_material(material_id))
    and (reference_id is null or exists (select 1 from public.reference_items r where r.id = reference_id and r.creator_id = app.current_creator_id()))
    and (artifact_id is null or (case when shared then app.owns_artifact(artifact_id) else app.can_read_artifact(artifact_id) end))
    and (collection_id is null or (not shared and app.owns_collection(collection_id)))
    and (conversation_id is null or (not shared and app.owns_conversation(conversation_id)))
    and (huddle_id is null or (not shared and (app.is_huddle_participant(huddle_id) or app.was_huddle_participant(huddle_id))))
  );

drop policy project_items_update on public.project_items;
create policy project_items_update on public.project_items for update to authenticated
  using (app.owns_project(project_id) or creator_id = app.current_creator_id())
  with check (
    (app.owns_project(project_id) or creator_id = app.current_creator_id())
    -- Only the owner of the work can share it.
    and (not shared or (creator_id = app.current_creator_id() and app.link_target_owned(creator_id, material_id, reference_id, artifact_id)))
  );
revoke update on public.project_items from authenticated;
grant update (note, position, shared, shared_at) on public.project_items to authenticated;

-- The project's owner removes any link; everyone can remove the links they added (their own work).
drop policy project_items_delete on public.project_items;
create policy project_items_delete on public.project_items for delete to authenticated
  using (app.owns_project(project_id) or creator_id = app.current_creator_id());

-- A shared link can be opened by the project's owner and its active crew, while the sharer still owns the work.
create or replace function app.can_open_shared_item(p_item uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_items i
    where i.id = p_item and i.shared and app.can_read_project(i.project_id)
      and app.link_target_owned(i.creator_id, i.material_id, i.reference_id, i.artifact_id)
  )
$$;

-- What the crew sees of shared work (listing): title, kind, who shared it. Nothing for non-members.
create or replace function public.project_shared_items(p_project uuid)
returns table (item_id uuid, kind text, title text, detail text, shared_by uuid, shared_by_name text, shared_at timestamptz, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.kind,
         coalesce(m.title, rm.title, a.title, 'Untitled'),
         coalesce(m.type::text, rm.type::text, a.artifact_type),
         i.creator_id, c.display_name, coalesce(i.shared_at, i.added_at), i.creator_id = app.current_creator_id()
  from public.project_items i
  join public.creators c on c.id = i.creator_id
  left join public.creative_materials m on m.id = i.material_id
  left join public.reference_items r on r.id = i.reference_id
  left join public.creative_materials rm on rm.id = r.material_id
  left join public.artifacts a on a.id = i.artifact_id
  where i.project_id = p_project and i.shared and app.can_read_project(p_project) and app.can_open_shared_item(i.id)
  order by coalesce(i.shared_at, i.added_at) desc
  limit 500
$$;

-- One shared item's content, read-only: a material's text and file (clean files only), or a piece's current version.
create or replace function public.project_shared_item(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare i public.project_items; v jsonb; mid uuid;
begin
  if not app.can_open_shared_item(p_item) then return null; end if;
  select * into i from public.project_items where id = p_item;
  mid := coalesce(i.material_id, (select r.material_id from public.reference_items r where r.id = i.reference_id));
  if mid is not null then
    select jsonb_build_object('kind', 'material', 'title', coalesce(m.title, 'Untitled'), 'type', m.type, 'text', left(coalesce(m.text_content, m.extracted_text, ''), 20000),
                              'sourceUrl', m.source_url, 'mimeType', so.mime_type, 'filePath', case when so.security_status = 'clean' and m.security_status = 'clean' then so.path end)
      into v
    from public.creative_materials m left join public.storage_objects so on so.id = m.storage_object_id where m.id = mid;
  else
    select jsonb_build_object('kind', 'artifact', 'title', a.title, 'type', a.artifact_type, 'status', a.status, 'versionNumber', ver.version_number, 'content', left(coalesce(ver.content, ''), 60000), 'updatedAt', a.updated_at)
      into v
    from public.artifacts a left join public.artifact_versions ver on ver.id = a.current_version_id where a.id = i.artifact_id;
  end if;
  return v || jsonb_build_object('itemId', i.id, 'projectId', i.project_id, 'sharedBy', (select display_name from public.creators where id = i.creator_id),
                                 'sharedById', i.creator_id, 'sharedAt', coalesce(i.shared_at, i.added_at), 'mine', i.creator_id = app.current_creator_id());
end $$;

-- Files of shared material can be signed by the crew (and only those files).
create or replace function app.can_read_crew_file(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.storage_objects so
    join public.creative_materials m on m.storage_object_id = so.id
    join public.project_items i on i.material_id = m.id or i.reference_id in (select r.id from public.reference_items r where r.material_id = m.id)
    where so.bucket = 'creator-media' and so.path = p_name and so.security_status = 'clean' and m.security_status = 'clean'
      and app.can_open_shared_item(i.id)
  )
$$;
create policy "creator media via crew" on storage.objects for select to authenticated
  using (bucket_id = 'creator-media' and app.can_read_crew_file(name));

-- Crew chat ------------------------------------------------------------------------------------------------------
create table public.crew_messages (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  creator_id uuid references public.creators(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  item_id uuid references public.project_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index crew_messages_crew_idx on public.crew_messages(crew_id, created_at desc);
create index crew_messages_creator_id_fk_idx on public.crew_messages(creator_id);
create index crew_messages_item_id_fk_idx on public.crew_messages(item_id);
alter table public.crew_messages enable row level security;
create policy crew_messages_read on public.crew_messages for select to authenticated
  using (app.crew_access(crew_id) is not null);
create policy crew_messages_insert on public.crew_messages for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and app.crew_access(crew_id) is not null
    and (item_id is null or exists (select 1 from public.project_items i join public.crews c on c.project_id = i.project_id
                                    where i.id = item_id and c.id = crew_id and i.shared))
  );
create policy crew_messages_delete on public.crew_messages for delete to authenticated
  using (creator_id = app.current_creator_id() or app.crew_access(crew_id) in ('owner', 'admin'));
revoke update on public.crew_messages from authenticated;

do $$
declare f text;
begin
  foreach f in array array['public.project_shared_items(uuid)', 'public.project_shared_item(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
