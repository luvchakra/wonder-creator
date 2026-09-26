-- P0.1-07 Rights detail & history: semantic, append-only rights events.
-- Events are written only by these triggers (security definer); creators can read their own and can't
-- insert, change or delete them (no policies for that; updates are also blocked by rights_events_immutable).
-- Details hold the facts of the change (names, kinds, statuses), not whole row snapshots.

create or replace function app.log_rights_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_rights uuid;
  v_creator uuid;
  v_events jsonb := '[]'::jsonb;
  e jsonb;
begin
  if tg_table_name = 'rights_records' then
    if tg_op = 'DELETE' then return old; end if;
    v_rights := new.id; v_creator := new.creator_id;
    if tg_op = 'INSERT' then
      v_events := jsonb_build_array(jsonb_build_object('event', 'rights.created', 'details',
        jsonb_build_object('copyright_holder', new.copyright_holder, 'ownership_kind', new.ownership_kind)));
    else
      if new.ownership_kind is distinct from old.ownership_kind then
        v_events := v_events || jsonb_build_object('event', 'ownership.updated', 'details', jsonb_build_object('from', old.ownership_kind, 'to', new.ownership_kind));
      end if;
      if new.copyright_holder is distinct from old.copyright_holder or new.copyright_registration is distinct from old.copyright_registration then
        v_events := v_events || jsonb_build_object('event', 'copyright.updated', 'details', jsonb_build_object('holder', new.copyright_holder, 'registration', new.copyright_registration));
      end if;
      if new.attribution_required is distinct from old.attribution_required then
        v_events := v_events || jsonb_build_object('event', 'attribution.changed', 'details', jsonb_build_object('required', new.attribution_required));
      end if;
      if new.derivatives_allowed is distinct from old.derivatives_allowed then
        v_events := v_events || jsonb_build_object('event', 'derivatives.changed', 'details', jsonb_build_object('allowed', new.derivatives_allowed));
      end if;
      if new.notes is distinct from old.notes then
        v_events := v_events || jsonb_build_object('event', 'notes.updated', 'details', '{}'::jsonb);
      end if;
    end if;
  elsif tg_table_name = 'rights_owners' then
    v_rights := coalesce(new.rights_id, old.rights_id); v_creator := coalesce(new.creator_id, old.creator_id);
    v_events := jsonb_build_array(jsonb_build_object(
      'event', case tg_op when 'INSERT' then 'owner.added' when 'DELETE' then 'owner.removed' else 'owner.updated' end,
      'details', jsonb_build_object('name', coalesce(new.owner_name, old.owner_name), 'share_percent', coalesce(new.share_percent, old.share_percent))));
  else -- licenses
    v_rights := coalesce(new.rights_id, old.rights_id); v_creator := coalesce(new.creator_id, old.creator_id);
    if tg_op = 'INSERT' then
      v_events := jsonb_build_array(jsonb_build_object('event', 'license.created', 'details', jsonb_build_object('license_type', new.license_type, 'licensee', new.licensee_name, 'status', new.status)));
    elsif tg_op = 'DELETE' then
      v_events := jsonb_build_array(jsonb_build_object('event', 'license.deleted', 'details', jsonb_build_object('license_type', old.license_type, 'licensee', old.licensee_name)));
    elsif new.status is distinct from old.status then
      v_events := jsonb_build_array(jsonb_build_object(
        'event', case new.status when 'active' then 'license.activated' when 'revoked' then 'license.revoked' when 'expired' then 'license.expired' else 'license.updated' end,
        'details', jsonb_build_object('license_type', new.license_type, 'licensee', new.licensee_name, 'from', old.status, 'to', new.status)));
    else
      v_events := jsonb_build_array(jsonb_build_object('event', 'license.updated', 'details', jsonb_build_object('license_type', new.license_type, 'licensee', new.licensee_name)));
    end if;
  end if;

  -- Cascading deletes (the artifact or account is being removed) take the whole history with them.
  if tg_op = 'DELETE' and not exists (select 1 from public.rights_records where id = v_rights) then
    return old;
  end if;
  for e in select * from jsonb_array_elements(v_events) loop
    insert into public.rights_events(rights_id, creator_id, event, details) values (v_rights, v_creator, e->>'event', e->'details');
  end loop;
  perform app.record_audit('rights.' || lower(tg_op), tg_table_name, coalesce(new.id, old.id), '{}'::jsonb, null);
  return coalesce(new, old);
end $$;

-- Publication history: visibility and status changes of the artifact are rights-relevant.
create or replace function app.log_publication_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid;
begin
  if new.privacy is not distinct from old.privacy and new.status is not distinct from old.status then return new; end if;
  select id into v_rights from public.rights_records where artifact_id = new.id;
  if v_rights is null then return new; end if;
  insert into public.rights_events(rights_id, creator_id, event, details)
  values (v_rights, new.creator_id, 'publication.changed',
          jsonb_build_object('privacy_from', old.privacy, 'privacy_to', new.privacy, 'status_from', old.status, 'status_to', new.status));
  return new;
end $$;
create trigger artifacts_publication_log after update of privacy, status on public.artifacts
  for each row execute function app.log_publication_change();

-- Derivatives: the source's rights history records that something was made from it (and by whom).
create or replace function app.log_derivative_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid; v_owner uuid;
begin
  if new.source_type <> 'artifact' or new.target_type <> 'artifact' or new.relationship not in ('adapted_from', 'derived_from') then return new; end if;
  select r.id, r.creator_id into v_rights, v_owner from public.rights_records r where r.artifact_id = new.source_id;
  if v_rights is null then return new; end if;
  insert into public.rights_events(rights_id, creator_id, event, details)
  values (v_rights, v_owner, 'derivative.created',
          jsonb_build_object('derivative_id', new.target_id, 'by_self', new.creator_id = v_owner));
  return new;
end $$;
create trigger lineage_derivative_log after insert on public.lineage_edges
  for each row execute function app.log_derivative_created();

revoke execute on function app.log_publication_change() from public, anon, authenticated;
revoke execute on function app.log_derivative_created() from public, anon, authenticated;
