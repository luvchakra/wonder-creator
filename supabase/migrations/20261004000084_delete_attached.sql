-- Deleting a Creation or a Material that was attached in a conversation failed with "Some details weren't valid."
-- (owner, 4 Oct 2026). The attachment's link was set to null, and an attachment must point at something, so the check
-- refused the whole delete. Now an attachment whose only link is the thing being deleted goes with it; one that still
-- points at the other (a Material and a Creation together) keeps that, as before. The attachment may be on someone
-- else's message (they could read the Creation), so this runs as definer — it only ever removes dangling attachments.
create or replace function app.drop_dangling_attachments()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'artifacts' then
    delete from public.conversation_attachments where artifact_id = old.id and material_id is null;
  else
    delete from public.conversation_attachments where material_id = old.id and artifact_id is null;
  end if;
  return old;
end $$;
revoke execute on function app.drop_dangling_attachments() from public, anon, authenticated;

create trigger artifacts_drop_attachments before delete on public.artifacts
  for each row execute function app.drop_dangling_attachments();
create trigger creative_materials_drop_attachments before delete on public.creative_materials
  for each row execute function app.drop_dangling_attachments();
