-- Performance pass (owner, 19 Oct 2026): indexes for the queries the app really runs, the delete paths that would
-- scan whole tables once there is data, the retention job, and two policies the advisor flags as doubled.
-- Nothing here changes what anyone can see or do. Plain `create index` (no `concurrently`): a migration runs in a
-- transaction, and these tables are small today.
--
-- Chosen from the live advisor's 61 "unindexed foreign key" findings, keeping only columns the app filters, orders or
-- deletes by. Audit-style columns (created_by, updated_by, proposed_by …) are deliberately left out: indexing them
-- would only slow writes. See docs/performance.md › Database.

-- Queries the app runs ------------------------------------------------------------------------------------------
-- The latest revision of a published piece (creator-publish: where artifact_id = … order by revision_number desc limit 1).
create index if not exists idx_published_revisions_artifact_id_revision_number on public.published_revisions (artifact_id, revision_number desc);

-- Home: the one pending DejaVu suggestion for me, and the suggestions a Moment already has.
create index if not exists idx_dejavu_suggestions_creator_id_status_created_at on public.dejavu_suggestions (creator_id, status, created_at desc);

-- Home: my recent DejaVu additions, newest first.
create index if not exists idx_dejavu_moments_creator_id_created_at on public.dejavu_moments (creator_id, created_at desc);

-- The bell's "couldn't be processed" line: only failed items, by recency.
create index if not exists idx_intake_items_creator_id_updated_at_failed on public.intake_items (creator_id, updated_at desc) where state = 'failed';

-- Image revisions: "is this asset busy?" before starting another.
create index if not exists idx_image_asset_revisions_asset_id_status on public.image_asset_revisions (asset_id, status);

-- Personal sources: a job's children (and the self-reference's cascade when old jobs are cleaned up).
create index if not exists idx_source_sync_jobs_parent_id on public.source_sync_jobs (parent_id) where parent_id is not null;

-- Semantic search reads embeddings by subject id; the primary key leads with the subject type.
create index if not exists idx_search_embeddings_subject_id on public.search_embeddings (subject_id);

-- Delete paths: removing a Material, a stored file, a part or a generation checks these children ---------------------
create index if not exists idx_image_generation_assets_storage_object_id on public.image_generation_assets (storage_object_id);
create index if not exists idx_image_generation_assets_thumbnail_object_id on public.image_generation_assets (thumbnail_object_id) where thumbnail_object_id is not null;
create index if not exists idx_image_generation_assets_saved_material_id on public.image_generation_assets (saved_material_id) where saved_material_id is not null;
create index if not exists idx_image_generation_assets_revision_of on public.image_generation_assets (revision_of) where revision_of is not null;
create index if not exists idx_image_generation_assets_replaced_by on public.image_generation_assets (replaced_by) where replaced_by is not null;
create index if not exists idx_moment_references_preview_asset_id on public.moment_references (preview_asset_id) where preview_asset_id is not null;
create index if not exists idx_source_context_records_material_id on public.source_context_records (material_id) where material_id is not null;
create index if not exists idx_project_part_events_part_id on public.project_part_events (part_id);
create index if not exists idx_project_mix_notes_part_id on public.project_mix_notes (part_id) where part_id is not null;

-- The daily retention job's predicates (otherwise each is a scan of the whole table) --------------------------------
create index if not exists idx_moment_references_deleted_at on public.moment_references (deleted_at) where deleted_at is not null;
create index if not exists idx_jobs_retention on public.jobs (updated_at) where status in ('succeeded', 'dead');
create index if not exists idx_source_context_records_expires_at on public.source_context_records (expires_at) where expires_at is not null;

-- Two tables had a SELECT policy and an "all" policy, so every read evaluated both. Writes are split by command; the
-- read policy is unchanged, and the checks are the same ones the "all" policy applied (an owner/admin is always a
-- reader, so update and delete still see the rows they change).
drop policy if exists project_milestones_write on public.project_milestones;
create policy project_milestones_write_insert on public.project_milestones for insert to authenticated
  with check (app.project_role(project_id) in ('owner', 'admin'));
create policy project_milestones_write_update on public.project_milestones for update to authenticated
  using (app.project_role(project_id) in ('owner', 'admin'))
  with check (app.project_role(project_id) in ('owner', 'admin'));
create policy project_milestones_write_delete on public.project_milestones for delete to authenticated
  using (app.project_role(project_id) in ('owner', 'admin'));

drop policy if exists project_rights_policies_write on public.project_rights_policies;
create policy project_rights_policies_write_insert on public.project_rights_policies for insert to authenticated
  with check (app.owns_project(project_id) and updated_by = app.current_creator_id());
create policy project_rights_policies_write_update on public.project_rights_policies for update to authenticated
  using (app.owns_project(project_id))
  with check (app.owns_project(project_id) and updated_by = app.current_creator_id());
create policy project_rights_policies_write_delete on public.project_rights_policies for delete to authenticated
  using (app.owns_project(project_id));

-- Home's visit marker is written on every Home load and a lost marker after a crash is harmless, so it doesn't wait
-- for the disk flush at commit. (set_config(…, true) lasts for this transaction; a function-level SET would be undone
-- before the commit.)
create or replace function public.mark_home_visit()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid := app.current_creator_id(); v_prev timestamptz;
begin
  if v_id is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform set_config('synchronous_commit', 'off', true);
  insert into public.creator_visits as v (creator_id) values (v_id)
  on conflict (creator_id) do update
     set previous_seen_at = case when v.last_seen_at < now() - interval '30 minutes' then v.last_seen_at else v.previous_seen_at end,
         last_seen_at = now()
  returning v.previous_seen_at into v_prev;
  return v_prev;
end $$;

-- Rate-limit counters are rewritten on almost every API call: leave room in each page for in-place updates and
-- vacuum them sooner, so the table stays a few pages instead of growing with churn.
alter table public.rate_limit_counters set (fillfactor = 60, autovacuum_vacuum_scale_factor = 0.02, autovacuum_vacuum_threshold = 50);
