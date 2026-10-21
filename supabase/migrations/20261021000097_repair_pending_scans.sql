-- Repair (21 Oct 2026): for a few hours after the Quick Pic speed-up (#200), files brought in passed the malware check
-- and were stored clean, but their Material kept the "pending" scan state the session guard (…008) gives it on insert,
-- so previews and downloads waited for a check that had already happened. Mark exactly those clean: the Material is
-- pending, its intake moved past the security check, and its stored file is recorded clean. Nothing else changes.
update public.creative_materials m
set security_status = 'clean'
from public.intake_items i
join public.storage_objects o on o.id = i.storage_object_id
where i.material_id = m.id
  and m.security_status = 'pending'
  and i.state in ('extracting', 'normalizing', 'understood', 'ready', 'failed')
  and o.security_status = 'clean';
