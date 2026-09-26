-- Performance hardening (Supabase advisors): covering indexes for foreign keys (cascading deletes and joins),
-- auth.uid() evaluated once per statement in RLS, and write policies split by command so reads aren't
-- evaluated against two permissive policies. Access rules are unchanged.

-- 1. Covering indexes for foreign keys.
create index if not exists ai_proposals_conversation_id_fk_idx on public.ai_proposals(conversation_id);
create index if not exists ai_proposals_run_id_fk_idx on public.ai_proposals(run_id);
create index if not exists ai_run_steps_creator_id_fk_idx on public.ai_run_steps(creator_id);
create index if not exists ai_runs_artifact_id_fk_idx on public.ai_runs(artifact_id);
create index if not exists ai_runs_conversation_id_fk_idx on public.ai_runs(conversation_id);
create index if not exists ai_tool_calls_creator_id_fk_idx on public.ai_tool_calls(creator_id);
create index if not exists ai_tool_calls_run_id_fk_idx on public.ai_tool_calls(run_id);
create index if not exists artifact_contributors_added_by_creator_id_fk_idx on public.artifact_contributors(added_by_creator_id);
create index if not exists artifact_contributors_contributor_creator_id_fk_idx on public.artifact_contributors(contributor_creator_id);
create index if not exists artifact_versions_created_by_ai_run_id_fk_idx on public.artifact_versions(created_by_ai_run_id);
create index if not exists artifact_versions_created_by_creator_id_fk_idx on public.artifact_versions(created_by_creator_id);
create index if not exists artifact_versions_creator_id_fk_idx on public.artifact_versions(creator_id);
create index if not exists artifact_versions_parent_version_id_fk_idx on public.artifact_versions(parent_version_id);
create index if not exists artifact_versions_restored_from_version_id_fk_idx on public.artifact_versions(restored_from_version_id);
create index if not exists artifacts_cover_material_id_fk_idx on public.artifacts(cover_material_id);
create index if not exists artifacts_current_version_id_fk_idx on public.artifacts(current_version_id);
create index if not exists artifacts_provenance_id_fk_idx on public.artifacts(provenance_id);
create index if not exists conversation_attachments_artifact_id_fk_idx on public.conversation_attachments(artifact_id);
create index if not exists conversation_attachments_creator_id_fk_idx on public.conversation_attachments(creator_id);
create index if not exists conversation_attachments_material_id_fk_idx on public.conversation_attachments(material_id);
create index if not exists conversation_attachments_message_id_fk_idx on public.conversation_attachments(message_id);
create index if not exists conversation_messages_creator_id_fk_idx on public.conversation_messages(creator_id);
create index if not exists creative_material_tags_creator_id_fk_idx on public.creative_material_tags(creator_id);
create index if not exists creative_materials_provenance_id_fk_idx on public.creative_materials(provenance_id);
create index if not exists creative_materials_storage_object_id_fk_idx on public.creative_materials(storage_object_id);
create index if not exists creative_memory_feedback_creator_id_fk_idx on public.creative_memory_feedback(creator_id);
create index if not exists creative_memory_feedback_memory_id_fk_idx on public.creative_memory_feedback(memory_id);
create index if not exists creator_blocks_blocked_creator_id_fk_idx on public.creator_blocks(blocked_creator_id);
create index if not exists creator_follows_followed_creator_id_fk_idx on public.creator_follows(followed_creator_id);
create index if not exists creator_relationships_creator_b_fk_idx on public.creator_relationships(creator_b);
create index if not exists creators_avatar_object_id_fk_idx on public.creators(avatar_object_id);
create index if not exists event_consumptions_event_id_fk_idx on public.event_consumptions(event_id);
create index if not exists huddle_invitations_invited_by_creator_id_fk_idx on public.huddle_invitations(invited_by_creator_id);
create index if not exists huddle_invitations_invitee_creator_id_fk_idx on public.huddle_invitations(invitee_creator_id);
create index if not exists huddle_join_requests_requester_creator_id_fk_idx on public.huddle_join_requests(requester_creator_id);
create index if not exists huddle_join_requests_resolved_by_creator_id_fk_idx on public.huddle_join_requests(resolved_by_creator_id);
create index if not exists huddle_messages_creator_id_fk_idx on public.huddle_messages(creator_id);
create index if not exists huddle_preserved_items_artifact_id_fk_idx on public.huddle_preserved_items(artifact_id);
create index if not exists huddle_preserved_items_creator_id_fk_idx on public.huddle_preserved_items(creator_id);
create index if not exists huddle_preserved_items_material_id_fk_idx on public.huddle_preserved_items(material_id);
create index if not exists huddles_started_by_creator_id_fk_idx on public.huddles(started_by_creator_id);
create index if not exists intake_items_material_id_fk_idx on public.intake_items(material_id);
create index if not exists intake_items_storage_object_id_fk_idx on public.intake_items(storage_object_id);
create index if not exists jobs_creator_id_fk_idx on public.jobs(creator_id);
create index if not exists licenses_creator_id_fk_idx on public.licenses(creator_id);
create index if not exists licenses_rights_id_fk_idx on public.licenses(rights_id);
create index if not exists lineage_edges_creator_id_fk_idx on public.lineage_edges(creator_id);
create index if not exists material_collection_items_creator_id_fk_idx on public.material_collection_items(creator_id);
create index if not exists material_collection_items_material_id_fk_idx on public.material_collection_items(material_id);
create index if not exists moderation_reports_reported_creator_id_fk_idx on public.moderation_reports(reported_creator_id);
create index if not exists moderation_reports_reporter_creator_id_fk_idx on public.moderation_reports(reporter_creator_id);
create index if not exists quality_reports_ai_run_id_fk_idx on public.quality_reports(ai_run_id);
create index if not exists quality_reports_creator_id_fk_idx on public.quality_reports(creator_id);
create index if not exists quality_reports_version_id_fk_idx on public.quality_reports(version_id);
create index if not exists reference_items_material_id_fk_idx on public.reference_items(material_id);
create index if not exists rights_events_creator_id_fk_idx on public.rights_events(creator_id);
create index if not exists rights_events_rights_id_fk_idx on public.rights_events(rights_id);
create index if not exists rights_owners_creator_id_fk_idx on public.rights_owners(creator_id);
create index if not exists rights_owners_owner_creator_id_fk_idx on public.rights_owners(owner_creator_id);
create index if not exists rights_owners_rights_id_fk_idx on public.rights_owners(rights_id);
create index if not exists rights_records_creator_id_fk_idx on public.rights_records(creator_id);

-- 2. Evaluate auth.uid() once per statement instead of per row.
drop policy memberships_self_read on public.tenant_memberships;
create policy memberships_self_read on public.tenant_memberships for select to authenticated
  using (user_id = (select auth.uid()));

drop policy creators_update_self on public.creators;
create policy creators_update_self on public.creators for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (avatar_object_id is null or app.owns_storage_object(avatar_object_id)));

-- 3. Write policies per command (reads keep their dedicated *_read policies, which already cover owners).
drop policy creator_disciplines_write on public.creator_disciplines;
create policy creator_disciplines_write_insert on public.creator_disciplines for insert to authenticated
  with check (creator_id = app.current_creator_id());
create policy creator_disciplines_write_update on public.creator_disciplines for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy creator_disciplines_write_delete on public.creator_disciplines for delete to authenticated
  using (creator_id = app.current_creator_id());
drop policy creator_skills_write on public.creator_skills;
create policy creator_skills_write_insert on public.creator_skills for insert to authenticated
  with check (creator_id = app.current_creator_id());
create policy creator_skills_write_update on public.creator_skills for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy creator_skills_write_delete on public.creator_skills for delete to authenticated
  using (creator_id = app.current_creator_id());
drop policy creator_languages_write on public.creator_languages;
create policy creator_languages_write_insert on public.creator_languages for insert to authenticated
  with check (creator_id = app.current_creator_id());
create policy creator_languages_write_update on public.creator_languages for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy creator_languages_write_delete on public.creator_languages for delete to authenticated
  using (creator_id = app.current_creator_id());
drop policy creator_interests_write on public.creator_interests;
create policy creator_interests_write_insert on public.creator_interests for insert to authenticated
  with check (creator_id = app.current_creator_id());
create policy creator_interests_write_update on public.creator_interests for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy creator_interests_write_delete on public.creator_interests for delete to authenticated
  using (creator_id = app.current_creator_id());
drop policy contributors_write on public.artifact_contributors;
create policy contributors_write_insert on public.artifact_contributors for insert to authenticated
  with check (app.owns_artifact(artifact_id) and added_by_creator_id = app.current_creator_id());
create policy contributors_write_update on public.artifact_contributors for update to authenticated
  using (app.owns_artifact(artifact_id)) with check (app.owns_artifact(artifact_id) and added_by_creator_id = app.current_creator_id());
create policy contributors_write_delete on public.artifact_contributors for delete to authenticated
  using (app.owns_artifact(artifact_id));
drop policy licenses_write on public.licenses;
create policy licenses_write_insert on public.licenses for insert to authenticated
  with check (creator_id = app.current_creator_id()
    and exists (select 1 from public.rights_records r where r.id = rights_id and r.creator_id = app.current_creator_id()));
create policy licenses_write_update on public.licenses for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id()
    and exists (select 1 from public.rights_records r where r.id = rights_id and r.creator_id = app.current_creator_id()));
create policy licenses_write_delete on public.licenses for delete to authenticated
  using (creator_id = app.current_creator_id());
drop policy rights_owners_write on public.rights_owners;
create policy rights_owners_write_insert on public.rights_owners for insert to authenticated
  with check (creator_id = app.current_creator_id()
    and exists (select 1 from public.rights_records r where r.id = rights_id and r.creator_id = app.current_creator_id()));
create policy rights_owners_write_update on public.rights_owners for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id()
    and exists (select 1 from public.rights_records r where r.id = rights_id and r.creator_id = app.current_creator_id()));
create policy rights_owners_write_delete on public.rights_owners for delete to authenticated
  using (creator_id = app.current_creator_id());

-- 4. Supabase's rls_auto_enable() (event trigger that enables RLS on new tables) isn't callable as an RPC, but
-- it is listed as executable by API roles; revoke to keep the API surface explicit. Triggers still fire.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
