-- A part's take with its background music (owner, 6 Oct 2026): when a part's current version carries a mix (the take
-- and its music, mixed on the creator's device and kept as their own audio Material), that mix is what the Room hears
-- — Listen together, the Room's hero and the published song. Otherwise the take, as before. Same checks either way:
-- the Material is the Creation owner's, and both it and its stored object passed the security checks.
create or replace function public.part_takes(p_project uuid)
returns table (part_id uuid, title text, artifact_id uuid, version_id uuid, version_number integer, storage_object_id uuid, seconds numeric)
language sql stable security definer set search_path = ''
as $$
  select pp.id, pp.title, pp.artifact_id, v.id, v.version_number, m.storage_object_id,
    coalesce(case when (v.structured_content -> src.key ->> 'seconds') ~ '^[0-9]+(\.[0-9]+)?$' then (v.structured_content -> src.key ->> 'seconds')::numeric end, 0)
  from public.project_parts pp
  join public.artifacts a on a.id = pp.artifact_id
  join public.artifact_versions v on v.id = a.current_version_id
  cross join lateral (
    select case when (v.structured_content -> 'mix' ->> 'materialId') ~ '^[0-9a-fA-F-]{36}$' then 'mix' else 'take' end as key
  ) src
  join public.creative_materials m
    on (v.structured_content -> src.key ->> 'materialId') ~ '^[0-9a-fA-F-]{36}$'
   and m.id = (v.structured_content -> src.key ->> 'materialId')::uuid
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
