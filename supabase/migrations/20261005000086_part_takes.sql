-- Play-along (docs/creative-room-parts.md, step 3): the lyricist hears the tune while writing; the singer hears it while
-- recording. A part's recording is its owner's private Material, so this returns, for each part of a Room whose current
-- version is a kept take, the storage object behind it — only to people who already read that part's Creation (the
-- Room's owner and crew, and anyone active on one of its parts: app.reads_part_artifact). The server then mints a
-- short-lived media link for exactly those objects; nothing else about who reads a Material changes.
create or replace function public.part_takes(p_project uuid)
returns table (part_id uuid, title text, artifact_id uuid, version_id uuid, version_number integer, storage_object_id uuid, seconds numeric)
language sql stable security definer set search_path = ''
as $$
  select pp.id, pp.title, pp.artifact_id, v.id, v.version_number, m.storage_object_id,
    coalesce(case when (v.structured_content -> 'take' ->> 'seconds') ~ '^[0-9]+(\.[0-9]+)?$' then (v.structured_content -> 'take' ->> 'seconds')::numeric end, 0)
  from public.project_parts pp
  join public.artifacts a on a.id = pp.artifact_id
  join public.artifact_versions v on v.id = a.current_version_id
  join public.creative_materials m
    on (v.structured_content -> 'take' ->> 'materialId') ~ '^[0-9a-fA-F-]{36}$'
   and m.id = (v.structured_content -> 'take' ->> 'materialId')::uuid
   and m.creator_id = a.creator_id
   and m.security_status = 'clean'
  join public.storage_objects so on so.id = m.storage_object_id and so.security_status = 'clean'
  where pp.project_id = p_project
    and v.structured_content ->> 'kind' = 'audio'
    and app.reads_part_artifact(pp.artifact_id)
  order by pp.position, pp.created_at
$$;
revoke execute on function public.part_takes(uuid) from public, anon;
grant execute on function public.part_takes(uuid) to authenticated;
