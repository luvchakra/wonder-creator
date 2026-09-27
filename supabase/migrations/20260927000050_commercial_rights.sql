-- P1-17 Commercial Rights Preparation. Makes a Creation's rights ready for brand and market workflows without drawing
-- legal conclusions:
-- * The creator's stance on commercial use (not offered · on request · open) and the channels they're open to.
-- * Usage channels on licenses (and in request/counter terms), carried into the license a request becomes.
-- * A commercial license request is refused when the owner doesn't offer commercial use.

-- 1. The creator's stance ------------------------------------------------------------------------------------
create or replace function app.valid_usage_channels(p text[])
returns boolean language sql immutable set search_path = ''
as $$
  select p is not null and cardinality(p) <= 10 and p <@ array['social', 'web', 'print', 'broadcast', 'streaming', 'advertising', 'packaging', 'merchandise', 'events', 'internal']::text[]
$$;

alter table public.rights_records
  add column commercial_use text not null default 'on_request' check (commercial_use in ('not_offered', 'on_request', 'open')),
  add column commercial_channels text[] not null default '{}' check (app.valid_usage_channels(commercial_channels));

alter table public.licenses
  add column usage_channels text[] not null default '{}' check (app.valid_usage_channels(usage_channels));

-- What someone who can see a Creation may know about its commercial availability (rights details stay owner-only).
create or replace function public.commercial_stance(p_artifact uuid)
returns table (commercial_use text, commercial_channels text[])
language sql stable security definer set search_path = ''
as $$
  select r.commercial_use, r.commercial_channels
  from public.rights_records r
  where r.artifact_id = p_artifact and app.can_read_artifact(p_artifact)
$$;
revoke execute on function public.commercial_stance(uuid) from public, anon;
grant execute on function public.commercial_stance(uuid) to authenticated;

-- 2. Requests respect the stance ------------------------------------------------------------------------------
create or replace function app.license_request_allowed(p_artifact uuid, p_terms jsonb)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(p_terms->>'license_type', '') <> 'commercial'
    or coalesce((select r.commercial_use from public.rights_records r where r.artifact_id = p_artifact), 'on_request') <> 'not_offered'
$$;
revoke execute on function app.license_request_allowed(uuid, jsonb) from public, anon;
grant execute on function app.license_request_allowed(uuid, jsonb) to authenticated;

drop policy license_requests_insert on public.license_requests;
create policy license_requests_insert on public.license_requests for insert to authenticated
  with check (
    requester_creator_id = app.current_creator_id()
    and status = 'pending' and counter_terms is null and response_note is null and license_id is null and responded_at is null
    and app.can_read_artifact(artifact_id)
    and exists (select 1 from public.artifacts a where a.id = artifact_id and a.creator_id = owner_creator_id and a.creator_id <> app.current_creator_id())
    and app.license_request_allowed(artifact_id, terms)
  );

-- 3. Channels travel into the license a request becomes --------------------------------------------------------
create or replace function app.license_from_terms(p_request public.license_requests, p_terms jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid; v_license uuid; v_mode text := coalesce(p_terms->>'mode', 'free_license'); v_channels text[];
begin
  select id into v_rights from public.rights_records where artifact_id = p_request.artifact_id;
  if v_rights is null then raise exception 'no rights record' using errcode = 'P0002'; end if;
  select coalesce(array_agg(distinct c), '{}') into v_channels
  from jsonb_array_elements_text(case when jsonb_typeof(p_terms->'usage_channels') = 'array' then p_terms->'usage_channels' else '[]'::jsonb end) c;
  if not app.valid_usage_channels(v_channels) then raise exception 'invalid usage channels' using errcode = '22023'; end if;
  insert into public.licenses (
    rights_id, creator_id, license_type, mode, licensee_name, licensee_creator_id, permitted_use, exclusive, territory,
    starts_on, ends_on, modification_allowed, derivatives_allowed, resale_allowed, attribution_required,
    fee_amount, fee_currency, edition_size, usage_channels, status
  )
  values (
    v_rights, p_request.owner_creator_id,
    coalesce(p_terms->>'license_type', 'personal'), v_mode,
    (select display_name from public.creators where id = p_request.requester_creator_id), p_request.requester_creator_id,
    left(p_request.proposed_use, 1000),
    coalesce((p_terms->>'exclusive')::boolean, v_mode = 'exclusive'),
    coalesce(nullif(p_terms->>'territory', ''), 'Worldwide'),
    nullif(p_terms->>'starts_on', '')::date, nullif(p_terms->>'ends_on', '')::date,
    coalesce((p_terms->>'modification_allowed')::boolean, false), coalesce((p_terms->>'derivatives_allowed')::boolean, false),
    coalesce((p_terms->>'resale_allowed')::boolean, false), coalesce((p_terms->>'attribution_required')::boolean, true),
    nullif(p_terms->>'fee_amount', '')::numeric, nullif(p_terms->>'fee_currency', ''), nullif(p_terms->>'edition_size', '')::int,
    v_channels,
    'active'
  )
  returning id into v_license;
  return v_license;
end $$;
revoke execute on function app.license_from_terms(public.license_requests, jsonb) from public, anon, authenticated;
