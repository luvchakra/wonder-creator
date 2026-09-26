-- Security hardening from the RLS/security test suite.

-- citext lives in the extensions schema, not public.
alter extension citext set schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Host-only Huddle controls must fail closed for non-participants (NULL role).
-- ---------------------------------------------------------------------------
create or replace function public.huddle_remove_participant(p_huddle uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  if app.huddle_role(p_huddle) is distinct from 'host' then raise exception 'only the host can remove participants' using errcode = '42501'; end if;
  if p_creator = v_me then raise exception 'use leave instead' using errcode = '22023'; end if;
  update public.huddle_participants set status = 'left', left_at = now() - interval '1 day'
    where huddle_id = p_huddle and creator_id = p_creator and status in ('joined', 'joining');
  if not found then raise exception 'participant not found' using errcode = 'P0002'; end if;
  perform app.huddle_log(p_huddle, 'HuddleParticipantRemoved');
  perform app.dissolve_if_empty(p_huddle);
end $$;

create or replace function public.huddle_end(p_huddle uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform app.require_creator();
  if app.huddle_role(p_huddle) is distinct from 'host' then raise exception 'only the host can end the huddle' using errcode = '42501'; end if;
  perform app.dissolve_huddle(p_huddle);
end $$;

-- A creator is in at most one live Huddle at a time.
create or replace function public.huddle_enter(p_huddle uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  if not exists (select 1 from public.huddles where id = p_huddle and status = 'live') then
    raise exception 'huddle is not live' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.huddle_participants p join public.huddles h on h.id = p.huddle_id
             where p.creator_id = v_me and p.status = 'joined' and h.status = 'live' and h.id <> p_huddle) then
    raise exception 'already in a live huddle' using errcode = '23505';
  end if;
  update public.huddle_participants
    set status = 'joined', joined_at = coalesce(joined_at, now()), left_at = null, last_seen_at = now()
    where huddle_id = p_huddle and creator_id = v_me
      and (status = 'joining' or (status = 'left' and left_at > now() - interval '10 minutes'));
  if not found then raise exception 'not admitted' using errcode = '42501'; end if;
  perform app.huddle_log(p_huddle, 'HuddleParticipantJoined');
end $$;

-- ---------------------------------------------------------------------------
-- 2. Ownership helpers for foreign references.
-- ---------------------------------------------------------------------------
create or replace function app.owns_storage_object(p uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.storage_objects o where o.id = p and o.creator_id = app.current_creator_id()) $$;
create or replace function app.owns_provenance(p uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.provenance_records r where r.id = p and r.creator_id = app.current_creator_id()) $$;
create or replace function app.owns_conversation(p uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.conversations c where c.id = p and c.creator_id = app.current_creator_id()) $$;
create or replace function app.owns_ai_run(p uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.ai_runs r where r.id = p and r.creator_id = app.current_creator_id()) $$;
create or replace function app.owns_memory(p uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.creative_memories m where m.id = p and m.creator_id = app.current_creator_id()) $$;

-- ---------------------------------------------------------------------------
-- 3. Artifacts: creators can read their own row during INSERT … RETURNING; references are owned.
-- ---------------------------------------------------------------------------
drop policy artifacts_read on public.artifacts;
create policy artifacts_read on public.artifacts for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_read_artifact(id));

drop policy artifacts_insert on public.artifacts;
create policy artifacts_insert on public.artifacts for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and app.owns_provenance(provenance_id)
    and (cover_material_id is null or app.owns_material(cover_material_id))
    and current_version_id is null
  );

drop policy artifacts_update on public.artifacts;
create policy artifacts_update on public.artifacts for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and app.owns_provenance(provenance_id)
    and (cover_material_id is null or app.owns_material(cover_material_id))
    and (current_version_id is null or exists (
      select 1 from public.artifact_versions v where v.id = current_version_id and v.artifact_id = artifacts.id))
  );

-- ---------------------------------------------------------------------------
-- 4. Materials, storage objects, intake: owned references; pipeline state is server-only.
-- ---------------------------------------------------------------------------
drop policy materials_own on public.creative_materials;
create policy materials_read on public.creative_materials for select to authenticated
  using (creator_id = app.current_creator_id());
create policy materials_insert on public.creative_materials for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and app.owns_provenance(provenance_id)
    and (storage_object_id is null or app.owns_storage_object(storage_object_id))
  );
create policy materials_update on public.creative_materials for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and app.owns_provenance(provenance_id)
    and (storage_object_id is null or app.owns_storage_object(storage_object_id))
  );
create policy materials_delete on public.creative_materials for delete to authenticated
  using (creator_id = app.current_creator_id());

-- Storage objects are registered by the server after validation (service role). Clients read/delete their own.
drop policy storage_objects_own on public.storage_objects;
create policy storage_objects_read on public.storage_objects for select to authenticated
  using (creator_id = app.current_creator_id());
create policy storage_objects_delete on public.storage_objects for delete to authenticated
  using (creator_id = app.current_creator_id());
alter table public.storage_objects
  add constraint storage_objects_path_owner check (split_part(path, '/', 1) = creator_id::text);

drop policy intake_own on public.intake_items;
create policy intake_read on public.intake_items for select to authenticated
  using (creator_id = app.current_creator_id());
-- Intake rows are written by the server pipeline (service role) so their state can't be forged.

-- Jobs are server-managed.
drop policy jobs_own on public.jobs;
create policy jobs_read on public.jobs for select to authenticated using (creator_id = app.current_creator_id());

-- Clients can never set scan/processing state. Typed text has nothing to scan.
create or replace function app.guard_material_pipeline_state()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::jsonb)->>'role', '') = 'service_role'
     or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.storage_object_id is null and new.source_url is null then
      new.security_status := 'clean';
      new.processing_state := 'ready';
    else
      new.security_status := 'pending';
      new.processing_state := 'received';
    end if;
  else
    new.security_status := old.security_status;
    new.processing_state := old.processing_state;
    new.storage_object_id := old.storage_object_id;
    new.source_url := old.source_url;
    new.extracted_text := old.extracted_text;
  end if;
  return new;
end $$;
create trigger materials_guard_pipeline before insert or update on public.creative_materials
  for each row execute function app.guard_material_pipeline_state();

-- ---------------------------------------------------------------------------
-- 5. Conversations, AI tracking, memory feedback: owned references.
-- ---------------------------------------------------------------------------
drop policy messages_own on public.conversation_messages;
create policy messages_own on public.conversation_messages for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.owns_conversation(conversation_id)
              and (ai_run_id is null or app.owns_ai_run(ai_run_id)));

drop policy ai_runs_own on public.ai_runs;
create policy ai_runs_own on public.ai_runs for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id()
              and (conversation_id is null or app.owns_conversation(conversation_id))
              and (artifact_id is null or app.owns_artifact(artifact_id)));

drop policy ai_run_steps_own on public.ai_run_steps;
create policy ai_run_steps_own on public.ai_run_steps for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.owns_ai_run(run_id));

drop policy ai_tool_calls_own on public.ai_tool_calls;
create policy ai_tool_calls_own on public.ai_tool_calls for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and (run_id is null or app.owns_ai_run(run_id)));

drop policy ai_proposals_own on public.ai_proposals;
create policy ai_proposals_own on public.ai_proposals for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id()
              and (run_id is null or app.owns_ai_run(run_id))
              and (conversation_id is null or app.owns_conversation(conversation_id)));

drop policy memory_feedback_own on public.creative_memory_feedback;
create policy memory_feedback_own on public.creative_memory_feedback for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.owns_memory(memory_id));

-- ---------------------------------------------------------------------------
-- 6. Rights history trigger must not break cascading deletes.
-- ---------------------------------------------------------------------------
create or replace function app.log_rights_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid; v_creator uuid;
begin
  if tg_table_name = 'rights_records' then
    v_rights := coalesce(new.id, old.id); v_creator := coalesce(new.creator_id, old.creator_id);
  else
    v_rights := coalesce(new.rights_id, old.rights_id); v_creator := coalesce(new.creator_id, old.creator_id);
  end if;
  if tg_op = 'DELETE' and (tg_table_name = 'rights_records'
      or not exists (select 1 from public.rights_records r where r.id = v_rights)) then
    return old; -- parent is being removed (cascade); nothing to log against
  end if;
  insert into public.rights_events(rights_id, creator_id, event, details)
  values (v_rights, v_creator, lower(tg_table_name) || '.' || lower(tg_op),
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  perform app.record_audit('rights.' || lower(tg_op), tg_table_name, coalesce(new.id, old.id), '{}'::jsonb, null);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Versions are immutable except for FK "set null" actions when referenced rows go away.
-- ---------------------------------------------------------------------------
drop trigger artifact_versions_immutable on public.artifact_versions;
create or replace function app.guard_version_immutable()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - array['created_by_ai_run_id', 'created_by_creator_id', 'parent_version_id', 'restored_from_version_id'])
     is distinct from (to_jsonb(old) - array['created_by_ai_run_id', 'created_by_creator_id', 'parent_version_id', 'restored_from_version_id'])
     or (new.created_by_ai_run_id is not null and new.created_by_ai_run_id is distinct from old.created_by_ai_run_id)
     or (new.created_by_creator_id is not null and new.created_by_creator_id is distinct from old.created_by_creator_id)
     or (new.parent_version_id is not null and new.parent_version_id is distinct from old.parent_version_id)
     or (new.restored_from_version_id is not null and new.restored_from_version_id is distinct from old.restored_from_version_id) then
    raise exception 'immutable record' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger artifact_versions_immutable before update on public.artifact_versions
  for each row execute function app.guard_version_immutable();

-- ---------------------------------------------------------------------------
-- 8. Clients cannot forge lifecycle events owned by database functions.
-- ---------------------------------------------------------------------------
create or replace function public.record_domain_event(
  p_event_type text, p_aggregate_type text, p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if p_event_type like 'Huddle%' and p_event_type <> 'HuddleContentPreserved' then
    raise exception 'event type is reserved' using errcode = '42501';
  end if;
  if p_event_type in ('ArtifactVersionCreated', 'RightsUpdated') then
    raise exception 'event type is reserved' using errcode = '42501';
  end if;
  return app.record_event(p_event_type, p_aggregate_type, p_aggregate_id, p_payload, p_correlation_id);
end $$;

-- create_artifact_version (security invoker) records its event through a definer wrapper.
create or replace function app.record_version_event(p_artifact uuid, p_version uuid, p_number int, p_author text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.owns_artifact(p_artifact) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform app.record_event('ArtifactVersionCreated', 'artifact', p_artifact,
    jsonb_build_object('versionId', p_version, 'versionNumber', p_number, 'authorKind', p_author));
end $$;

create or replace function public.create_artifact_version(
  p_artifact_id uuid, p_content text, p_label text, p_author_kind text, p_change_summary text default null,
  p_structured_content jsonb default null, p_generation_metadata jsonb default null,
  p_ai_run_id uuid default null, p_restored_from uuid default null
) returns public.artifact_versions
language plpgsql security invoker set search_path = ''
as $$
declare v_artifact public.artifacts; v_next int; v_row public.artifact_versions;
begin
  select * into v_artifact from public.artifacts where id = p_artifact_id for update;
  if not found or v_artifact.creator_id <> app.current_creator_id() then
    raise exception 'artifact not found' using errcode = 'P0002';
  end if;
  if v_artifact.status = 'archived' then raise exception 'artifact is archived' using errcode = '22023'; end if;
  if p_author_kind not in ('creator', 'ai', 'restore') then raise exception 'invalid author' using errcode = '22023'; end if;
  if p_ai_run_id is not null and not app.owns_ai_run(p_ai_run_id) then raise exception 'invalid run' using errcode = '42501'; end if;
  if p_restored_from is not null and not exists (
    select 1 from public.artifact_versions v where v.id = p_restored_from and v.artifact_id = p_artifact_id) then
    raise exception 'restore source is not a version of this artifact' using errcode = '22023';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next from public.artifact_versions where artifact_id = p_artifact_id;
  insert into public.artifact_versions(
    artifact_id, creator_id, version_number, parent_version_id, label, content, structured_content,
    generation_metadata, change_summary, author_kind, created_by_creator_id, created_by_ai_run_id, restored_from_version_id
  ) values (
    p_artifact_id, v_artifact.creator_id, v_next, v_artifact.current_version_id, coalesce(nullif(p_label, ''), 'Draft'),
    coalesce(p_content, ''), p_structured_content, p_generation_metadata, p_change_summary, p_author_kind,
    case when p_author_kind = 'ai' then null else v_artifact.creator_id end, p_ai_run_id, p_restored_from
  ) returning * into v_row;
  update public.artifacts set current_version_id = v_row.id where id = p_artifact_id;
  perform app.record_version_event(p_artifact_id, v_row.id, v_next, p_author_kind);
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Internal functions are not callable by clients.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema app from public, anon, authenticated;
-- Functions used inside RLS policies must remain executable by the roles evaluating them.
grant execute on function
  app.current_creator_id(), app.current_tenant_id(), app.is_tenant_member(uuid), app.can_view_creator(uuid),
  app.owns_material(uuid), app.owns_artifact(uuid), app.can_read_artifact(uuid), app.is_huddle_participant(uuid),
  app.huddle_role(uuid), app.owns_storage_object(uuid), app.owns_provenance(uuid), app.owns_conversation(uuid),
  app.owns_ai_run(uuid), app.owns_memory(uuid), app.record_version_event(uuid, uuid, int, text)
to anon, authenticated;
-- Trigger functions run as the table owner context; they need no client grants.
