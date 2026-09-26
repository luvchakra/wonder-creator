-- Viewers of a public artifact see only the published (current) version.
-- Draft history stays with the creator and named contributors.
drop policy versions_read on public.artifact_versions;
create policy versions_read on public.artifact_versions for select to authenticated
  using (
    creator_id = app.current_creator_id()
    or exists (select 1 from public.artifact_contributors ac where ac.artifact_id = artifact_versions.artifact_id and ac.contributor_creator_id = app.current_creator_id())
    or exists (
      select 1 from public.artifacts a
      where a.id = artifact_versions.artifact_id and a.current_version_id = artifact_versions.id
        and a.privacy = 'public' and a.status in ('final', 'published') and app.can_view_creator(a.creator_id)
    )
  );
