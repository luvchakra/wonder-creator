-- Second hardening pass from the security test suite.

-- Personal tenants are removed with their last member (no orphaned personal data).
create or replace function app.cleanup_personal_tenant()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.tenants t
  where t.id = old.tenant_id and t.kind = 'personal'
    and not exists (select 1 from public.tenant_memberships m where m.tenant_id = t.id);
  return old;
end $$;
create trigger tenant_memberships_cleanup after delete on public.tenant_memberships
  for each row execute function app.cleanup_personal_tenant();

-- Remove tenants already orphaned.
delete from public.tenants t where t.kind = 'personal'
  and not exists (select 1 from public.tenant_memberships m where m.tenant_id = t.id)
  and not exists (select 1 from public.creators c where c.tenant_id = t.id);

-- Attachments only on the caller's own messages.
drop policy attachments_own on public.conversation_attachments;
create policy attachments_own on public.conversation_attachments for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and exists (select 1 from public.conversation_messages m where m.id = message_id and m.creator_id = app.current_creator_id())
    and (material_id is null or app.owns_material(material_id))
    and (artifact_id is null or app.can_read_artifact(artifact_id))
  );

-- Avatars must be the creator's own storage object.
drop policy creators_update_self on public.creators;
create policy creators_update_self on public.creators for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (avatar_object_id is null or app.owns_storage_object(avatar_object_id)));

-- Quality reports reference a version of the same artifact.
drop policy quality_own on public.quality_reports;
create policy quality_own on public.quality_reports for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id() and app.owns_artifact(artifact_id)
    and exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = quality_reports.artifact_id)
    and (ai_run_id is null or app.owns_ai_run(ai_run_id))
  );

-- Provenance links must point at the caller's own conversation / run / preserved huddle outcome.
drop policy provenance_own on public.provenance_records;
create policy provenance_own on public.provenance_records for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and (conversation_id is null or app.owns_conversation(conversation_id))
    and (ai_run_id is null or app.owns_ai_run(ai_run_id))
    and (huddle_id is null or app.is_huddle_participant(huddle_id)
         or exists (select 1 from public.huddle_preserved_items p where p.huddle_id = provenance_records.huddle_id and p.creator_id = app.current_creator_id()))
  );

-- Lineage sources of every type are ownership-checked.
drop policy lineage_write on public.lineage_edges;
create policy lineage_write on public.lineage_edges for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and case target_type
      when 'artifact' then app.owns_artifact(target_id)
      when 'material' then app.owns_material(target_id)
      else exists (select 1 from public.artifact_versions v where v.id = target_id and app.owns_artifact(v.artifact_id))
    end
    and case source_type
      when 'artifact' then app.can_read_artifact(source_id)
      when 'material' then app.owns_material(source_id)
      when 'artifact_version' then exists (select 1 from public.artifact_versions v where v.id = source_id and app.can_read_artifact(v.artifact_id))
      when 'conversation' then app.owns_conversation(source_id)
      when 'reference' then exists (select 1 from public.reference_items r where r.id = source_id and r.creator_id = app.current_creator_id())
      when 'huddle' then app.is_huddle_participant(source_id)
        or exists (select 1 from public.huddle_preserved_items p where p.huddle_id = source_id and p.creator_id = app.current_creator_id())
      else false
    end
  );

-- Future app.* functions are not executable by clients unless granted explicitly.
alter default privileges in schema app revoke execute on functions from public;
revoke execute on function app.record_version_event(uuid, uuid, int, text) from anon;
